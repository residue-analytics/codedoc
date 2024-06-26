#!/usr/bin/env python

##################################################################################################
#
# Copyright 2024, Shalin Garg
#
# This file is part of CodeDoc Gen AI Tool.
#
# CodeDoc is free software: you can redistribute it and/or modify it under the terms of the 
# GNU General Public License as published by the Free Software Foundation, either version 3 
# of the License, or (at your option) any later version.
#
# CodeDoc is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without 
# even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU 
# General Public License for more details.
#
# You should have received a copy of the GNU General Public License along with CodeDoc. 
# If not, see <https://www.gnu.org/licenses/>.
#
##################################################################################################

__version__ = "0.1"
__author__  = "Shalin Garg"

import re
import os
import shutil
import magic
from typing              import Annotated
from pathlib             import Path
from natsort             import os_sorted
from fastapi             import Depends, APIRouter, Request, HTTPException
from fastapi.responses   import FileResponse
from fastapi             import UploadFile

from PyPDF2              import PdfReader

from libs.data           import File
from libs.auth           import get_current_active_user, User
from libs.github_api     import GithubAPI

__all__ = ["router", "INPUT_CODE_DIR", "OUTPUT_CODE_DIR"]

INPUT_CODE_DIR = "./oldcode"
OUTPUT_CODE_DIR = "./newcode"
SUPP_MIME_TYPES = [ re.compile("^application/pdf$"), re.compile("^text/.*") ]

githubAPI = None
router = APIRouter()
reponame = os.getenv("DOCS_REPONAME")
repobranch = ""
if not reponame or len(reponame) == 0:
    print("Documentation Repository not set")
else:
    githubAPI = GithubAPI()
    repobranch = os.getenv("DOCS_REPO_BRANCH")

def get_editable_file(file_path: Path):
    # Find the highest versioned file in the output folder
    stem = file_path.stem    # string - /outputdir/html/css/styles
    file_list = [file for file in file_path.parent.glob(stem + ".*")]
    if len(file_list) > 0:
        return sorted(file_list, key=lambda x: get_version(x), reverse=True)[0]
    else:
        return None

def get_version(file_path):
    split_name = file_path.name.split('.')
    if len(split_name) == 1:
        return 0
    if split_name[-1].isdigit():
        return int(split_name[-1])
    elif split_name[-2].isdigit():
        return int(split_name[-2])
    else:
        return 0

def get_file_version_names(fileName: File):
    file_path = Path(fileName)   # a/b/n1, a/b/n1.py, n1.1.py, n1.tar.1.gz, n1.1, n1.tar.gz
    dir_path  = file_path.parent      # a/b,    a/b,
    base_name = file_path.stem        # n1,     n1,        n1.1,    n1.tar.1,    n1,   n1.tar
    suffix = file_path.suffix         # '',     .py,       .py,     .gz,         .1,   .gz
    filename_wo_ver = fileName

    # Using Path().name to split for cases where dir name has a '.' and we don't want dirname to be split
    split_name = file_path.name.split('.')
    curVer = 0
    newVer = 0
    curfilepath = Path(OUTPUT_CODE_DIR + "/" + fileName)
    newfilepath = None
    if len(split_name) == 1:
        # No suffix filename
        newVer = curVer + 1
        curfilepath = Path(INPUT_CODE_DIR + "/" + fileName)
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + fileName + "." + str(newVer))
        # No change in filename_wo_ver
    elif split_name[-1].isdigit():
        # No suffix filename, having a version as suffix
        if not Path(OUTPUT_CODE_DIR + "/" + fileName).exists():
            raise HTTPException(status_code=409, detail={'msg': f"Versioned File [{fileName}] with version [{split_name[-1]}] does not exist."})
            
        curVer = int(split_name[-1])
        newVer = curVer + 1
        temp = base_name + "." + str(newVer)
        newfilepath = Path(OUTPUT_CODE_DIR) / dir_path / temp
        filename_wo_ver = (dir_path / base_name).as_posix()
    elif split_name[-2].isdigit():
        # With suffix filename, having a version as second last
        if not curfilepath.exists():
            raise HTTPException(status_code=409, detail={'msg': f"Versioned File [{fileName}] with version [{split_name[-2]}] does not exist."})
            
        curVer = int(split_name[-2])
        newVer = curVer + 1
        split_name[-2] = str(newVer)    # Replace the version number
        newName = ".".join(split_name)
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + str(file_path.with_name(newName)))

        split_name.pop(-2)    # Remove the version number
        newName = ".".join(split_name)
        filename_wo_ver = file_path.with_name(newName).as_posix()
    else:
        # There is no version in the filename and there are more than 1 parts in the filename
        newVer = 1
        temp = base_name + "." + str(newVer) + suffix
        curfilepath = Path(INPUT_CODE_DIR) / fileName
        newfilepath = Path(OUTPUT_CODE_DIR) / dir_path / temp
        # Original name has no version so, no change in filename_wo_ver

        #raise HTTPException(status_code=406, detail={'msg': f"File [{fileName}] not satisfying the versioning structure"})

    return (curfilepath, newfilepath, filename_wo_ver, curVer, newVer)

@router.get("/files/")
def get_dirlist(current_user: Annotated[User, Depends(get_current_active_user)],
                editable: bool = False) -> dict:
    basedir  = None
    if editable:
        basedir = OUTPUT_CODE_DIR
    else:
        basedir = INPUT_CODE_DIR

    filepath = Path(basedir + "/")
    if filepath.is_dir():
        files_paths = []
        for file in filepath.glob("**/*"):
            if not (file.name.startswith('_') or file.name.startswith('.')):
                if not file.is_dir():
                    files_paths.append(file.relative_to(basedir).as_posix())
        # files = os.listdir("./" + dir_path)
        #files_paths = sorted([f"{request.url._url}/{f}" for f in files if not (f.startswith('.') or f.startswith('_'))])
        return {'dirname': "/", 'files': os_sorted(files_paths)}
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})

@router.get("/gitfiles/")
def get_gitdirlist(current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:

    if not reponame or len(reponame) == 0:
        raise HTTPException(status_code=404, detail={'msg': 'No Git Repository configured'})

    try:
        files_paths = githubAPI.get_full_dirtree(reponame, repobranch)
        return {'dirname': "/", 'files': os_sorted(files_paths)}
    except Exception as excp:
        raise HTTPException(status_code=excp.status, detail={'msg': excp.message})

@router.get("/files/{file_path:path}")
def get_file(file_path: str, current_user: Annotated[User, Depends(get_current_active_user)],
             raw: bool = False, editable: bool = False):
    if file_path.find("..") != -1:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})
    
    basedir  = None
    findVersionedFile = False
    if editable:
        basedir = OUTPUT_CODE_DIR
        findVersionedFile = True
    else:
        basedir = INPUT_CODE_DIR

    filepath = Path(basedir + "/" + file_path)

    if filepath.is_file():   # We don't have un-versioned files in output directory
        if raw:
            return FileResponse(str(filepath))    # FastAPI to return proper content headers
        else:
            return File(name=file_path, version=get_version(filepath), content=filepath.read_text())
    elif findVersionedFile:
        # Try to find the versioned files
        most_recent_file = get_editable_file(filepath)
        if most_recent_file is None:
            raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})
        else:
            return File(name=most_recent_file.relative_to(basedir).as_posix(), version=get_version(most_recent_file), content=most_recent_file.read_text())
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})

@router.get("/gitfiles/{file_path:path}")
def get_gitfile(file_path: str, current_user: Annotated[User, Depends(get_current_active_user)]):

    if not reponame or len(reponame) == 0:
        raise HTTPException(status_code=404, detail={'msg': 'No Git Repository configured'})

    try:
        file_content = githubAPI.get_file_contents(reponame, file_path, repobranch)
        return File(name=file_path, version=-1, content=file_content)
    except Exception as excp:
        raise HTTPException(status_code=excp.status, detail={'msg': excp.message})

@router.delete("/files/{file_path:path}")
def delete_file(file_path:str, editable: bool,
                current_user: Annotated[User, Depends(get_current_active_user)]) -> dict:
    if file_path.find("..") != -1 or editable != True:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})

    basedir  = None
    if editable:
        basedir = OUTPUT_CODE_DIR
    else:
        basedir = INPUT_CODE_DIR

    filepath = Path(basedir + "/" + file_path)
    if (not filepath.exists()):
        return {'name': file_path, 'deleted': True}
    
    if filepath.is_file():
        filepath.unlink(missing_ok=True)  # Don't raise error if file is not present
    elif filepath.is_dir():
        filepath.rmdir()
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not find {filepath.name}"})
    
    return {'name': file_path, 'deleted': True}

@router.put("/files/{dir_path:path}")
def save_file(dir_path: str, fileData: File, request: Request,
              current_user: Annotated[User, Depends(get_current_active_user)]) -> File:
    if dir_path.find("..") != -1 or fileData.name.find("..") != -1:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})

    curfilepath, newfilepath, filename_wo_ver, curVer, newVer = get_file_version_names(fileData.name)

    if newfilepath.exists():
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with new version [{newVer}] already exists."})

    # Create the directory structure, don't raise exceptions if paths exist
    newfilepath.parent.mkdir(mode=0o744, parents=True, exist_ok=True)

    try:
        newfilepath.touch(mode=0o644, exist_ok=False)  # Raises FileExistsError if file already exists (expecting this to take care of any race conditions too)
    except FileExistsError:
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with new version [{newVer}] already exists."})

    newfilepath.write_text(fileData.content)

    # Update git as well
    if reponame and len(reponame) > 0:
        # Compare contents in GIT with previous version
        fileExistsInGit = False
        try:
            if curfilepath.exists():
                gitContent = githubAPI.get_file_contents(reponame, filename_wo_ver, repobranch)
                fileExistsInGit = True
                #print(gitContent)
                localContent = curfilepath.read_text()
                if localContent != gitContent:
                    fileData.commitDiff = string_diff(localContent, gitContent)
                    print(fileData.commitDiff)
                    fileData.name = newfilepath.relative_to(OUTPUT_CODE_DIR).as_posix()
                    fileData.version = newVer
                    fileData.content = None
                    fileData.commit = "Git Content mismatch, syncup content with Git. New file version saved locally."
                    return fileData
        except Exception as exp:
            if exp.status != 404:
                fileData.name = newfilepath.relative_to(OUTPUT_CODE_DIR).as_posix()
                fileData.version = newVer
                fileData.content = None
                fileData.commit = "Git content fetch failed, not committing to Git. New file version saved locally."
                return fileData
        try:
            #print("Checking in to GIT " + filename_wo_ver)
            if fileExistsInGit:
                fileData.commit = githubAPI.update_file(reponame, filename_wo_ver, fileData.content, repobranch,
                    f"Updating versioned file [{newfilepath.relative_to(OUTPUT_CODE_DIR).as_posix()}]",
                    current_user.fullname, current_user.email)
            else:
                fileData.commit = githubAPI.create_new_file(reponame, filename_wo_ver, fileData.content, repobranch,
                    f"Updating versioned file [{newfilepath.relative_to(OUTPUT_CODE_DIR).as_posix()}]",
                    current_user.fullname, current_user.email)
        except Exception as exp:
            print(exp)
            fileData.commit = "Git Commit failed. New file version saved locally."

    fileData.name = newfilepath.relative_to(OUTPUT_CODE_DIR).as_posix()
    fileData.version = newVer
    fileData.content = None
    return fileData

@router.post("/uploadfiles/{dir_path:path}")
async def create_upload_files(dir_path:str, files: list[UploadFile],
                              current_user: Annotated[User, Depends(get_current_active_user)]):
    if dir_path.find("..") != -1:
        raise HTTPException(status_code=403, detail={'msg': "Forbidden access"})

    resp_obj = {"dirpath": dir_path, "filenames": []}

    for file in files:
        file_mime = magic.from_buffer(file.file.read(2048), mime=True)
        if not any(mime.match(file_mime) for mime in SUPP_MIME_TYPES):
            print(f"Forbidden File Type [{file.filename}:{file_mime}] upload by [{current_user.fullname}]")
            raise HTTPException(status_code=403, detail={'msg': "Forbidden File Type"})

        file.file.seek(0)    # Return to the starting of the file
        curfilepath = Path(INPUT_CODE_DIR) / dir_path / file.filename
        if curfilepath.exists():
            raise HTTPException(status_code=409, detail={'msg': f"File [{file.filename}] already exists at [{dir_path}]."})

        # Create the directory structure, don't raise exceptions if paths exist
        curfilepath.parent.mkdir(mode=0o744, parents=True, exist_ok=True)

        try:
            curfilepath.touch(mode=0o644, exist_ok=False)  # Raises FileExistsError if file already exists (expecting this to take care of any race conditions too)
        except FileExistsError:
            raise HTTPException(status_code=409, detail={'msg': f"File [{file.filename}] already exists at [{dir_path}]."})

        try:
            if file_mime == "application/pdf":
                reader = PdfReader(file.file)
                text = ""
                for page in reader.pages:
                    text+=page.extract_text()
                new_text = text.replace('\u25AA',"").replace("z\n","")

                with curfilepath.open("w") as buffer:
                    buffer.write(new_text)
            else:        
                with curfilepath.open("wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)
            
            resp_obj["filenames"].append(file.filename)
        finally:
            file.file.close()

    return resp_obj

def string_diff(s1: str, s2: str) -> str:
    d1, d2 = [], []
    i1 = i2 = 0
    l1 = len(s1)
    l2 = len(s2)
    while True:
        if i1 >= len(s1) or i2 >= len(s2):
            d1.extend(s1[i1:])
            d2.extend(s2[i2:])
            break
        if s1[i1] != s2[i2]:
            e1 = l1 - i1
            e2 = l2 - i2
            if e1 > e2:
                d1.append(s1[i1])
                i2 -= 1
            elif e1 < e2:
                d2.append(s2[i2])
                i1 -= 1
            else:
                d1.append(s1[i1])
                d2.append(s2[i2])
        i1 += 1
        i2 += 1
    return ["".join(d1), "".join(d2)]

if __name__ == '__main__':
  print ('Cannot execute as a program, it is a module')
