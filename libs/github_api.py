#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"

import os
from base64    import b64encode
from pathlib   import Path
from github    import Github
from github    import Auth
from github    import InputGitAuthor

__all__ = []

class GithubAPI:
  def __init__(self, oauth_token=None):
    if not oauth_token:
      oauth_token = os.getenv("GITHUB_API_ACCESS_TOKEN")
    
    # using an access token
    self.auth = Auth.Token(oauth_token)

    # Public Web Github
    self.git = Github(auth=self.auth)

  def close(self):
    self.git.close()
  
  def get_repos(self):
    all_repos = []
    for repo in self.git.get_user().get_repos():
      all_repos.append(repo.name)

    return all_repos

  def get_full_dirtree(self, reponame: str, branch: str):
    repo = self.git.get_repo(reponame)
    contents = repo.get_contents("")
    dirtree = []
    while contents:
      file_content = contents.pop(0)
      if file_content.type == "dir":
        contents.extend(repo.get_contents(file_content.path, branch))
      else:
        dirtree.append(file_content.path)

    return dirtree

  def get_file_contents(self, reponame: str, filename: str, branch: str):
    # throws Exception. exp.status == 404 (Not found)
    repo = self.git.get_repo(reponame)
    contents = repo.get_contents(filename, branch)

    return contents.decoded_content.decode('utf-8')   # decoded from base64 as bytes b'file contents.....'

  def create_new_file(self, reponame: str, filename: str, contents: str | bytes, branch: str, 
    commitmsg: str, committername: str, committeremail: str):
    committer = InputGitAuthor(committername, committeremail)
    repo = self.git.get_repo(reponame)
    resp = repo.create_file(filename, commitmsg, contents, branch, committer)

    return resp["commit"].sha  # commit hash

  def update_file(self, reponame: str, filename: str, new_contents: str | bytes, branch: str, 
    commitmsg: str, committername: str, committeremail: str):
    # throws Exception. exp.status == 404 (Not found)
    committer = InputGitAuthor(committername, committeremail)
    repo = self.git.get_repo(reponame)
    contents = repo.get_contents(filename)
    if self.compare_contents(new_contents, contents.decoded_content):
      # Both are same, no changes to commit
      print("No change in contents, skipping Git Commit")
      return None
    
    resp = repo.update_file(filename, commitmsg, new_contents, contents.sha, branch, committer)
    
    return resp["commit"].sha  # commit hash

  def create_or_update_file(self, reponame: str, filename: str, new_contents: str | bytes, branch: str, 
    commitmsg: str, committername: str, committeremail: str):
    
    try:
      return self.update_file(reponame, filename, new_contents, branch, commitmsg, committername, committeremail)
    except Exception as excp:
      print(excp)
      if excp.status == 404:
        return self.create_new_file(reponame, filename, new_contents, branch, commitmsg, committername, committeremail)
      else:
        raise excp

  def compare_contents(self, content1: str | bytes, content2: str | bytes):
    # str & bytes, both must be readable content not base64 encoded
    #print(content1)
    #print(content2)
    if not isinstance(content1, bytes):
      content1 = content1.encode("utf-8")

    if not isinstance(content2, bytes):
      content2 = content2.encode("utf-8")

    # Now both are encoded bytes, we can compare them now
    return content1 == content2


if __name__ == '__main__':
  print ('Cannot execute as a program, it is a module')
