# API Keys

To generate a new API key, first create a random key like:
```bash
tr -dc A-Za-z0-9 </dev/urandom | head -c 20 ; echo ''
```

Then you can add the key to the database by connecting to the `db-client` instance, running `./connect-db.sh` and then running:
```sql
INSERT INTO "APIKey" ("createdAt", "updatedAt", name, key) VALUES (now(), now(), 'some name that describes the key', 'the key from above');
```
