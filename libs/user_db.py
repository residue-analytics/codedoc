import sqlite3 
#import hashlib

__all__ = ['User', 'UserCredentials', 'UserDatabase']

class User: 
    def __init__(self, id, email, fullname, disabled=False): 
        self.id = id
        self.email = email 
        self.fullname = fullname 
        self.disabled = disabled
    
    def toJSON(self):
        return f"ID [{self.id}] Email [{self.email}] Name [{self.fullname}] Disabled [{self.disabled}]"

class UserCredentials: 
    def __init__(self, user_id, username, password): 
        self.user_id = user_id
        self.username = username 
        self.password = password
    
    def toJSON(self):
        return f"User ID [{self.user_id}] Username [{self.username}] Pass [{self.password}]"

class UserDatabase: 
    def __init__(self, db_name): 
        self.conn = sqlite3.connect(db_name) 
        self.cursor = self.conn.cursor() 
        self.create_tables()
    
    def create_tables(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                email TEXT,
                fullname TEXT,
                disabled INTEGER
            )
        ''')

        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS user_credentials (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                password TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        self.conn.commit()

    def check_tables_exist(self):
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        users_table = self.cursor.fetchone()
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_credentials'")
        credentials_table = self.cursor.fetchone()
        return users_table and credentials_table

    def add_user(self, user):
        # This should autoincrement the id column, id value in the user object is ignored
        self.cursor.execute("INSERT INTO users ('email', 'fullname', 'disabled') VALUES (?, ?, ?)", (user.email, user.fullname, user.disabled))
        self.conn.commit()

    def add_user_credentials(self, credentials):
        self.cursor.execute('INSERT INTO user_credentials VALUES (?, ?, ?)', (credentials.user_id, credentials.username, credentials.password))
        self.conn.commit()

    def get_user_by_id(self, id):
        self.cursor.execute('SELECT * FROM users WHERE id = ?', (id,))
        row = self.cursor.fetchone()
        if row:
            id, email, fullname, disabled = row
            return User(id, email, fullname, bool(disabled))
        return None
    
    def get_user_by_email(self, email):
        self.cursor.execute('SELECT * FROM users WHERE email = ?', (email,))
        row = self.cursor.fetchone()
        if row:
            id, email, fullname, disabled = row
            return User(id, email, fullname, bool(disabled))
        return None

    def get_user_by_username(self, username):
        self.cursor.execute('SELECT users.* FROM users INNER JOIN user_credentials ON users.id = user_credentials.user_id WHERE user_credentials.username = ?', (username,))
        row = self.cursor.fetchone()
        if row:
            id, email, fullname, disabled = row
            return User(id, email, fullname, bool(disabled))
        return None

    def get_user_credentials_by_userid(self, user_id):
        self.cursor.execute('SELECT * FROM user_credentials WHERE user_id = ?', (user_id,))
        row = self.cursor.fetchone()
        if row:
            user_id, username, password = row
            return UserCredentials(user_id, username, password)
        return None
    
    def get_user_credentials(self, username):
        self.cursor.execute('SELECT * FROM user_credentials WHERE username = ?', (username,))
        row = self.cursor.fetchone()
        if row:
            user_id, username, password = row
            return UserCredentials(user_id, username, password)
        return None

    def update_user(self, user):
        self.cursor.execute('UPDATE users SET email = ?, fullname = ?, disabled = ? WHERE id = ?', (user.email, user.fullname, user.disabled, user.id))
        self.conn.commit()

    def update_user_credentials(self, credentials):
        self.cursor.execute('UPDATE user_credentials SET password = ? WHERE user_id =? and username = ?', (credentials.password, credentials.user_id, credentials.username))
        self.conn.commit()

    def delete_user(self, id):
        self.cursor.execute('DELETE FROM users WHERE id = ?', (id,))
        self.delete_user_credentials(id)
        self.conn.commit()

    def delete_user_credentials(self, user_id):
        self.cursor.execute('DELETE FROM user_credentials WHERE user_id = ?', (user_id,))
        self.conn.commit()

    def fetch_all_users(self):
        self.cursor.execute('SELECT * FROM users')
        rows = self.cursor.fetchall()
        for row in rows:
            user_id, email, fullname, disabled = row
            yield User(user_id, email, fullname, bool(disabled))

    def fetch_all_user_credentials(self):
        self.cursor.execute('SELECT * FROM user_credentials')
        rows = self.cursor.fetchall()
        for row in rows:
            user_id, username, password = row
            yield UserCredentials(user_id, username, password)

#    def hash_password(self, password):
#        return hashlib.sha256(password.encode()).hexdigest()

#    def verify_password(self, password, hashed_password):
#        return hashed_password == self.hash_password(password)
