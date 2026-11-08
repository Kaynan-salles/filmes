import sqlite3

c = sqlite3.connect('WEB_PORTAL/data/animes_catalog.db')
for row in c.execute("SELECT sql FROM sqlite_master WHERE type='table';").fetchall():
    print(row[0])
