#!/usr/bin/env python

__version__ = "0.1"
__author__  = "Shalin Garg"

import sqlite3 
import hashlib

__all__ = ['User', 'UserCredentials', 'UserDatabase', 'ParamsDatabase']

class User: 
    def __init__(self, id, email, fullname, disabled=False): 
        self.id = id
        self.email = email 
        self.fullname = fullname 
        self.disabled = disabled
    
    def toString(self):
        return f"ID [{self.id}] Email [{self.email}] Name [{self.fullname}] Disabled [{self.disabled}]"

class UserCredentials: 
    def __init__(self, user_id, username, password): 
        self.user_id = user_id
        self.username = username 
        self.password = password
    
    def toString(self):
        return f"User ID [{self.user_id}] Username [{self.username}] Pass [{self.password}]"

class LLMParamsRec:
    def __init__(self, name, user_id, timestamp, data, data_hash=None):
        self.tm = timestamp
        self.name = name            # Like LLM ID or something on which a query is needed
        self.user_id = user_id
        self.type = 'llm_params'
        self.data = data
        self.data_hash = data_hash

    def toString(self):
        return f"llmID [{self.name}] Type [{self.type}] User [{self.user_id}] TS [{self.tm}] Data [{self.data}] Hash[{self.data_hash}]"
    
    def toDict(self):
        return {
            'tm': self.tm,
            'name': self.name,
            'user_id': self.user_id,
            'type': self.type,
            'data': self.data,
            'data_hash': self.data_hash
        }

class UserDatabase: 
    def __init__(self, db_name): 
        self.db_name = db_name
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
        user_id = self.get_user_id_by_username(username)
        if user_id:
            self.cursor.execute('SELECT * FROM users WHERE users.id = ?', (user_id,))
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

    def get_user_id_by_username(self, username):
        self.cursor.execute('SELECT * FROM user_credentials WHERE username = ?', (username,))
        row = self.cursor.fetchone()
        if row:
            user_id, username, password = row
            return user_id
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

class ParamsDatabase:
    def __init__(self, db_name): 
        self.db_name = db_name
        self.conn = sqlite3.connect(db_name) 
        self.cursor = self.conn.cursor() 
        self.create_tables()
    
    def create_tables(self):
        self.cursor.execute('''
            CREATE TABLE IF NOT EXISTS params (
                tm INTEGER PRIMARY KEY,
                type TEXT,
                user_id INTEGER,
                name TEXT,
                data TEXT,
                hash TEXT,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        self.cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS hash_idx ON params (
                user_id, hash
            )
        ''')

        self.cursor.execute('''
            CREATE INDEX IF NOT EXISTS hash_only_idx ON params (
                hash
            )
        ''')

        self.conn.commit()

    def check_tables_exist(self):
        self.cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='params'")
        params_table = self.cursor.fetchone()
        return params_table

    def check_hash_exists(self, user_id, hash_data):
        # Except user_id all other distinctive props are within the hashed JSON data
        self.cursor.execute("SELECT tm FROM params WHERE user_id = ? AND hash = ?", (user_id, hash_data))
        row = self.cursor.fetchone()
        if row:
            return True
        else:
            return False

    def add_params(self, params):
        hash_data = self.hash_data(params.data)
        if not self.check_hash_exists(params.user_id, hash_data):
            self.cursor.execute("INSERT INTO params ('tm', 'type', 'user_id', 'name', 'data', 'hash') VALUES (?, ?, ?, ?, ?, ?)", 
                            (params.tm, params.type, params.user_id, params.name, 
                             params.data, hash_data))
            self.conn.commit()

    def add_params_by_username(self, params, username):
        users_db = UserDatabase(self.db_name)
        user_id = users_db.get_user_id_by_username(username)
        if user_id:
            params.user_id = user_id
            self.add_params(params)
        else:
            raise ValueError(f"No user found with name [{username}]")

    def get_params_by_username(self, username):
        users_db = UserDatabase(self.db_name)
        user_id = users_db.get_user_id_by_username(username)
        if user_id:
            return self.get_params_by_userid(user_id)
        
        return None

    def get_latest_by_name_username(self, name, username):
        users_db = UserDatabase(self.db_name)
        user_id = users_db.get_user_id_by_username(username)
        if user_id:
            self.cursor.execute('SELECT * FROM params WHERE user_id = ? AND name = ? ORDER BY tm DESC LIMIT 1', (user_id, name))
            row = self.cursor.fetchone()
            if row:
                tm, type, user_id, name, data, hash = row
                if type == "llm_params":
                    return LLMParamsRec(name, user_id, tm, data, hash)
        return None
                
    def get_params_by_userid(self, user_id):
        self.cursor.execute('SELECT * FROM params WHERE user_id = ?', (user_id,))
        rows = self.cursor.fetchall()
        param_list = []
        for row in rows:
            tm, type, user_id, name, data, hash = row
            if type == "llm_params":
                param_list.append(LLMParamsRec(name, user_id, tm, data, hash))
        
        if len(param_list) > 0:
            return param_list
        
        return None

    def get_params_by_hash(self, data_hash):
        self.cursor.execute('SELECT * FROM params WHERE hash = ?', (data_hash,))
        rows = self.cursor.fetchall()
        param_list = []
        for row in rows:
            tm, type, user_id, name, data, hash = row
            if type == "llm_params":
                param_list.append(LLMParamsRec(name, user_id, tm, data, hash))
        
        if len(param_list) > 0:
            return param_list
        
        return None

    def get_all_params(self):
        self.cursor.execute("select * from params")
        rows = self.cursor.fetchall()
        param_list = []
        for row in rows:
            tm, type, user_id, name, data, hash = row
            if type == "llm_params":
                param_list.append(LLMParamsRec(name, user_id, tm, data, hash))
        
        if len(param_list) > 0:
            return param_list
        
        return None

    def get_count_by_name(self, username, name):
        users_db = UserDatabase(self.db_name)
        user_id = users_db.get_user_id_by_username(username)
        if user_id:
            self.cursor.execute('select count(*) from params where user_id = ? AND name = ?', (user_id, name))
            row = self.cursor.fetchone()
            return row[0]
        return 0
        
    def delete_param(self, tm, user_id):
        self.cursor.execute('DELETE FROM params WHERE tm = ? AND user_id = ?', (tm, user_id))
        self.conn.commit()

    def delete_all_params(self, user_id):
        self.cursor.execute('DELETE FROM params WHERE user_id = ?', (user_id))
        self.conn.commit()

    def hash_data(self, data:str):
        return hashlib.sha256(data.encode()).hexdigest()