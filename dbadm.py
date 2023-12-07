#!/usr/bin/env python

import argparse
import logging
import getpass
from passlib.context import CryptContext
from libs.user_db import *
from libs         import auth
import sys
import os

parser = argparse.ArgumentParser(description="Inspect Docs DB")
parser.add_argument("--db", help="sqllite DB File Path (default: taken from appcode)")
parser.add_argument("--log", help="Log Filename")
parser.add_argument("--debug", action='store_true', help="Enable Debug logging")

args = parser.parse_args()

if args.log is None:
  logging.basicConfig(level=logging.INFO,
                      format='%(asctime)s|%(levelname)s|%(threadName)s|%(filename)s|%(funcName)s|%(message)s')
else:
  logging.basicConfig(filename=args.log,
                      level=logging.INFO,
                      format='%(asctime)s|%(levelname)s|%(threadName)s|%(filename)s|%(funcName)s|%(message)s')

if args.debug:
  logging.getLogger().setLevel(logging.DEBUG)
else:
  logging.getLogger().setLevel(logging.INFO)

db_file = auth.sqllite_dbname
if args.db:
  db_file = args.db

users_db = UserDatabase(db_file)
#pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def command(args=None):
  if args is None:
    args = input("Command to execute: ")

  if isinstance(args, list):
    print(os.system(" ".join(args)))
  else:
    print(os.system(args))

def help():
  print(func_list.keys())

def quit():
  sys.exit("Done..")

def print_in_columns(alist):
  cols = 5    # print() format is not dynamically sized yet
  size = len(alist)
  if size % cols != 0:
    alist.extend([ " " for i in range(0, cols - (size % cols)) ])
    size = len(alist)

  offset = int(size/cols)
  print( "\n".join("%-21s %-21s %-21s %-21s %s"%(alist[i], alist[i+offset], alist[i+2*offset], alist[i+3*offset], alist[i+4*offset]) for i in range(offset)) )

def login_pass():
  user = input("Username winpty [%s]: " % getpass.getuser())
  if not user:
    user = getpass.getuser()

  pprompt = lambda: (getpass.getpass(), getpass.getpass('Retype password: '))

  p1, p2 = pprompt()
  while p1 != p2:
    print('Passwords do not match. Try again or Ctrl-C')
    p1, p2 = pprompt()

  return user, p1


def verify_login():
  name, secret = login_pass()
  
  try:
    creds = auth.authenticate_user(users_db, name, secret)
    if creds is None or not creds:
      print("No such user or bad password")
    else:
      print(creds.model_dump())
  except ValueError as ve:
    print(ve)

def update_password():
  name, secret = login_pass()
  secret = auth.get_password_hash(secret)

  try:
    user = users_db.get_user_by_username(name)
    cred = users_db.get_user_credentials(name)
    if user and cred:
      cred.password = secret
      users_db.update_user_credentials(cred)
      print("Update Success")
    else:
      print("User not Found")
  except ValueError as ve:
    print(ve)

def usr_prof():
  profid = input("User's Profile ID (Enter to skip) :")
  prof = None
  if profid is not None and len(profid) > 0:
    prof = users_db.get_user_by_id(profid)
    if prof is not None:
      print(prof.toJSON())
    else:
      print("No Profile Found")
  else:
    email = input("User's Email ID :")
    if email is not None:
      prof = users_db.get_user_by_email(email)
      if prof is not None:
        print(prof.toJSON())
      else:
        print("No Profile Found")
  
  if prof is not None:
    chgsta = input("Disable this User? (Enter to skip or True|1) :")
    if chgsta == "True" or chgsta == 1:
      newsta = bool(chgsta)
      prof.disabled = newsta
      prof = users_db.update_user(prof)
      prof = users_db.get_user_by_email(prof.email)  # Just refetch and show changed status
      if prof is not None:
        print(prof.toJSON())
      else:
        print("Profile Status not Saved or Email not found")

def delete_profile():
  prof_to_delete = None
  profid = input("User's Profile ID :")
  if profid is None:
    email = input("User's Email ID :")
    if email is not None:
      prof_to_delete = users_db.get_user_by_email(email)
    else:
      username = input("User's Username :")
      prof_to_delete = users_db.get_user_by_username(username)
  else:
    prof_to_delete = users_db.get_user_by_id(profid)

  if prof_to_delete is None:
    print("No user found")
  else:
    resp = input(f"Delete User [{prof_to_delete.fullname}] ? [Yy] :")
    if resp != "Y" and resp != "y":
      return
    else:
      # First delete the cred and then the User
      users_db.delete_user_credentials(prof_to_delete.id)
      users_db.delete_user(prof_to_delete.id)

def all_users():
  # Fetch all users
  for user in users_db.fetch_all_users():
    print(user.toJSON())

  # Fetch all user credentials
  for credentials in users_db.fetch_all_user_credentials():
    print(credentials.toJSON())

def create_login():
  username, secret = login_pass()
  secret = auth.get_password_hash(secret)
  
  email = input("Email: ")
  fullname = input("Full Name: ")
  disabled = input("User Disabled: ")
  if disabled == "Y" or disabled == "y":
    disabled = True
  else:
    disabled = False

  users_db.add_user(User(None, email, fullname, disabled))
  user = users_db.get_user_by_email(email)
  users_db.add_user_credentials(UserCredentials(user.id, username, secret))


func_list = {
    "cmd"        : command,       # Execute a System Command
    "lgncrt"     : create_login,  # Create a new User Login
    "lgnver"     : verify_login,  # Verify User Login / Password
    "pwdupd"     : update_password,  # Update Login Details
    "usrprf"     : usr_prof,      # View User's Profile
    "prfdel"     : delete_profile,# Delete a profile by ID, email or Username
    "all"        : all_users,     # Print all Users and Usernames    
    "help"       : help,
    "quit"       : quit
  }

## Infinite Loop
while True:
  try:
    cmd = input("Command [Ctrl-C to exit] :")
    if cmd is not None and len(cmd) > 0:
      cmd_args = cmd.split()
      cmd = func_list.get(cmd_args[0])
      if cmd is not None:
        if len(cmd_args) > 1:
          cmd(args=cmd_args[1:])
        else:
          cmd()
      else:
        print("Command not found")

  except ValueError as ve:
    print(ve)
  except SystemExit:
    break
  except KeyboardInterrupt:
    break
  except:
    logging.error("Caught [%s] exception [%s]" % (str(sys.exc_info()[0]), str(sys.exc_info()[1])))
    logging.exception(sys.exc_info()[1])
