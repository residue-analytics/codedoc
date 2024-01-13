#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"

from typing import Annotated
from pathlib             import Path

from fastapi             import Depends, APIRouter, Request, HTTPException
from fastapi.responses   import FileResponse

from libs.data           import File
from libs.auth           import get_current_active_user, User

__all__ = ["router", "INPUT_CODE_DIR", "OUTPUT_CODE_DIR"]

INPUT_CODE_DIR = "./oldcode"
OUTPUT_CODE_DIR = "./newcode"

router = APIRouter()

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
        return {'dirname': "/", 'files': files_paths}
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})

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
            return File(name=file_path, content=filepath.read_text())
    elif findVersionedFile:
        # Try to find the versioned files
        most_recent_file = get_editable_file(filepath)
        if most_recent_file is None:
            raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})
        else:
            return File(name=most_recent_file.relative_to(basedir).as_posix(), version=get_version(most_recent_file), content=most_recent_file.read_text())
    else:
        raise HTTPException(status_code=404, detail={'msg': f"Could not read {filepath.name}"})

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

    file_path = Path(fileData.name)   # a/b/n1, a/b/n1.py, n1.1.py, n1.tar.1.gz, n1.1, n1.tar.gz
    dir_path  = file_path.parent      # a/b,    a/b,
    base_name = file_path.stem        # n1,     n1,        n1.1,    n1.tar.1,    n1,   n1.tar
    suffix = file_path.suffix         # '',     .py,       .py,     .gz,         .1,   .gz

    # Using Path().name to split for cases where dir name has a '.' and we don't want dirname to be split
    split_name = file_path.name.split('.')
    curVer = 0
    newVer = 0
    newfilepath = None
    if len(split_name) == 1:
        # No suffix filename
        newVer = curVer + 1
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + fileData.name + "." + str(newVer))
    elif split_name[-1].isdigit():
        # No suffix filename, having a version as suffix
        if not Path(OUTPUT_CODE_DIR + "/" + fileData.name).exists():
            raise HTTPException(status_code=409, detail={'msg': f"Versioned File [{fileData.name}] with version [{split_name[-1]}] does not exist."})
            
        curVer = int(split_name[-1])
        newVer = curVer + 1
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + dir_path.name + "/" + base_name + "." + str(newVer))
    elif split_name[-2].isdigit():
        # With suffix filename, having a version as second last
        if not Path(OUTPUT_CODE_DIR + "/" + fileData.name).exists():
            raise HTTPException(status_code=409, detail={'msg': f"Versioned File [{fileData.name}] with version [{split_name[-2]}] does not exist."})
            
        curVer = int(split_name[-2])
        newVer = curVer + 1
        split_name[-2] = str(newVer)    # Replace the version number
        newName = ".".join(split_name)
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + str(file_path.with_name(newName)))
    else:
        # There is no version in the filename and there are more than 1 parts in the filename
        newVer = 1
        newfilepath = Path(OUTPUT_CODE_DIR + "/" + dir_path.name + "/" + base_name + "." + str(newVer) + suffix)

        #raise HTTPException(status_code=406, detail={'msg': f"File [{fileData.name}] not satisfying the versioning structure"})

    if newfilepath.exists():
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with new version [{newVer}] already exists."})

    # Create the directory structure, don't raise exceptions if paths exist
    newfilepath.parent.mkdir(mode=0o644, parents=True, exist_ok=True)

    try:
        newfilepath.touch(mode=0o644, exist_ok=False)  # Raises FileExistsError if file already exists (expecting this to take care of any race conditions too)
    except FileExistsError:
        raise HTTPException(status_code=409, detail={'msg': f"File [{fileData.name}] with new version [{newVer}] already exists."})

    newfilepath.write_text(fileData.content)
    
    fileData.name = newfilepath.relative_to(OUTPUT_CODE_DIR).as_posix()
    fileData.version = newVer
    fileData.content = None
    return fileData

if __name__ == '__main__':
  print ('Cannot execute as a program, it is a module')
