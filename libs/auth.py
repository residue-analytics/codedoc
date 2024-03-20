#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"

from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Depends, APIRouter, HTTPException, status, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestFormStrict
from jose import JWTError, jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from .user_db import UserDatabase

from typing import cast, Any
from fastapi.security import OAuth2
from fastapi.openapi.models import OAuthFlows as OAuthFlowsModel
from fastapi import Request, Cookie
from fastapi.security.utils import get_authorization_scheme_param
from typing import Optional
from typing import Dict

# to get a string like this run:
# openssl rand -hex 32
# SECRET_KEY = "03ce19ebe700afcd4567b4665569f3685339508bfeacd978ae28caa5eba0b787"
SECRET_KEY = os.getenv("TOKEN_ENC_KEY")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 120

sqlite_dbname = 'codegen_user.db'
users_db = UserDatabase(sqlite_dbname)

fake_users_db = {
    "shalin": {
        "username": "shalin",
        "fullname": "Shalin Garg",
        "email": "shalin@example.com",
        "hashed_password": "$2b$12$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQoeG6Lruj3vjPGga31lW",
        "disabled": False,
    }
}


class OAuth2PasswordBearerWithCookie(OAuth2):
    def __init__(
        self,
        tokenUrl: str,
        scheme_name: Optional[str] = None,
        scopes: Optional[Dict[str, str]] = None,
        auto_error: bool = True,
    ):
        if not scopes:
            scopes = {}
        flows = OAuthFlowsModel(
            password=cast(Any, {"tokenUrl": tokenUrl, "scopes": scopes})
        )
        super().__init__(flows=flows, scheme_name=scheme_name, auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[str]:
        authorization: str = request.cookies.get("session_id")  #changed to accept access token from httpOnly Cookie
        #print("access_token is", authorization)

        #scheme, param = get_authorization_scheme_param(authorization)
        #if not authorization or scheme.lower() != "bearer":
        if not authorization:
            if self.auto_error:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Not authenticated",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            else:
                return None
        return authorization

class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    username: str | None = None


class User(BaseModel):
    username: str
    email: str | None = None
    fullname: str | None = None
    disabled: bool | None = None


class UserInDB(User):
    hashed_password: str


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

#oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")
oauth2_scheme = OAuth2PasswordBearerWithCookie(tokenUrl="token")

router = APIRouter()

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password):
    return pwd_context.hash(password)


def get_user(db, username: str):
    user = db.get_user_by_username(username)
    if user:
        return User(username=username, email=user.email, fullname=user.fullname, disabled=user.disabled)
    return None

def get_credentials(db, username:str):
    credentials = db.get_user_credentials(username)
    if credentials:
        # Now get the user details and then merge them in one object
        user = db.get_user_by_id(credentials.user_id)
        return UserInDB(username=username, email=user.email, fullname=user.fullname, 
                        disabled=user.disabled, hashed_password=credentials.password)
    return None

def authenticate_user(db, username: str, password: str):
    user = get_credentials(db, username)
    if not user:
        return False
    if user.disabled:
        return False
    if not verify_password(password, user.hashed_password):
        return False
    return user


def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)],
                           response: Response):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        
        expires = datetime.fromtimestamp(payload.get("exp"), timezone.utc)
        if expires < datetime.now(timezone.utc):
            raise credentials_exception

        if expires - datetime.now(timezone.utc) < timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES):
            # token expiring within 30 minutes, reissue a new one
            access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
            access_token = create_access_token(
                data={"sub": username}, expires_delta=access_token_expires
            )
            response.set_cookie(key="session_id", value=access_token, 
                                expires=datetime.now(timezone.utc) + access_token_expires, secure=False, httponly=True)
        
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = get_user(users_db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)]
):
    if current_user.disabled:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user


@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: Annotated[OAuth2PasswordRequestFormStrict, Depends()],
    response: Response):
    user = authenticate_user(users_db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )

    response.set_cookie(key="session_id", value=access_token, 
                        expires=datetime.now(timezone.utc) + access_token_expires, secure=False, httponly=True)
    return Token(access_token=access_token, token_type="bearer")

@router.get("/logout")
async def logout(response: Response):
    response.set_cookie(key="session_id", value="", 
                        expires=datetime.now(timezone.utc), secure=False, httponly=True)
    return {"result": "success"}
    
@router.get("/users/me/", response_model=User)
async def read_users_me(
    current_user: Annotated[User, Depends(get_current_active_user)]
):
    return current_user


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(router, host="localhost", port=8000)
