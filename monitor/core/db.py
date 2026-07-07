import sqlite3

#need to see if the db file exists at path in container
#if not create the db with the schema
#need a method to get a name by coreid
#need a method to get a location by coreid
#need a method to change name by coreid
#need a method to change location by coreid

import sqlite3
import os

DB_PATH = '/monitor/data/monitor.db'

class MonitorDB:
    def __init__(self):
        self._init_db()

    def _init_db(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.executescript('''
            CREATE TABLE IF NOT EXISTS core (
                core_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_heard TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS location_history (
                core_id TEXT NOT NULL,
                lat REAL NOT NULL,
                long REAL NOT NULL,
                effective_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                effective_end TIMESTAMP,
                FOREIGN KEY (core_id) REFERENCES core(core_id)
            );
            CREATE TABLE IF NOT EXISTS name_history (
                core_id TEXT NOT NULL,
                name TEXT NOT NULL,
                effective_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                effective_end TIMESTAMP,
                FOREIGN KEY (core_id) REFERENCES core(core_id)
            );
            CREATE VIEW IF NOT EXISTS current_state AS
                SELECT c.core_id, c.last_heard, l.lat, l.long, n.name
                FROM core c
                LEFT JOIN location_history l ON c.core_id = l.core_id AND l.effective_end IS NULL
                LEFT JOIN name_history n ON c.core_id = n.core_id AND n.effective_end IS NULL;
        ''')
        conn.commit()
        conn.close()

    def coreid_exists(self, coreid):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT 1 FROM core WHERE core_id = ?', (coreid,))
        row = cursor.fetchone()
        conn.close()
        return row is not None

    def add_coreid(self, coreid):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('INSERT INTO core (core_id) VALUES (?)', (coreid,))
        conn.commit()
        conn.close()
        
    def get_name_by_coreid(self, coreid):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT name FROM current_state WHERE core_id = ?', (coreid,))
        row = cursor.fetchone()
        conn.close()
        return row[0] if row else None

    def get_location_by_coreid(self, coreid):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT lat, long FROM current_state WHERE core_id = ?', (coreid,))
        row = cursor.fetchone()
        conn.close()
        return (row[0], row[1]) if row else None

    def change_name_by_coreid(self, coreid, name):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''UPDATE name_history SET effective_end = CURRENT_TIMESTAMP
                        WHERE core_id = ? AND effective_end IS NULL''', (coreid,))
        cursor.execute('''INSERT INTO name_history (core_id, name)
                        VALUES (?, ?)''', (coreid, name))
        conn.commit()
        conn.close()

    def change_location_by_coreid(self, coreid, lat, lon):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''UPDATE location_history SET effective_end = CURRENT_TIMESTAMP
                        WHERE core_id = ? AND effective_end IS NULL''', (coreid,))
        cursor.execute('''INSERT INTO location_history (core_id, lat, long)
                        VALUES (?, ?, ?)''', (coreid, lat, lon))
        conn.commit()
        conn.close()

    def change_last_heard_by_core_id(self, coreid, last_heard):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''UPDATE core SET last_heard = ?
                        WHERE core_id = ?''', (last_heard, coreid))
        conn.commit()
        conn.close()

    def get_all_coreids(self):
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT core_id FROM core')
        rows = cursor.fetchall()
        conn.close()
        return [row[0] for row in rows]


monitor_db = MonitorDB()
