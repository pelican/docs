# Panel Setup

> Generate the Panel .env file and APP_KEY with p:environment:setup, set file permissions and finish the install in the web installer.

Source: https://pelican.dev/docs/panel/standalone/panel-setup/

The core environment is easily configured using a single CLI command & the web installer built into the app.
These steps will cover setting up things such as sessions, caching, database credentials, and email sending.

Running `php artisan p:environment:setup` will, if it does not exist, auto create the required `.env` file and generate a `APP_KEY`.

```sh
sudo php artisan p:environment:setup
```

> **Warning: BACK UP APP_KEY!**
>
> **Back up** your encryption key (APP_KEY in the `.env` file). This is used as an encryption key for all data that needs to be stored securely (e.g. api keys).
> Store it somewhere safe - not just on your server. If you lose it all encrypted data is irrecoverable -- **even if you have database backups.**

## Setting Permissions

The next step in the installation process is to set the correct permissions on the Panel files so that the webserver can
use them correctly.

```sh
sudo chmod -R 755 storage/* bootstrap/cache/
```

### NGINX/Apache/Caddy

```sh
sudo chown -R www-data:www-data /var/www/pelican
```

### Rocky Linux NGINX

```sh
sudo chown -R nginx:nginx /var/www/pelican
```

### Rocky Linux Apache

```sh
sudo chown -R apache:apache /var/www/pelican
```

## Web-Installer

Once you've set the proper permissions, continue the Panel install on the web interface.
The web installer is located at `<domain>/installer` or `<ip>/installer`.

> **Info: Want something advanced?**
>
> Make sure to read the [MySQL guide](https://pelican.dev/docs/panel/advanced/mysql/) first if you want to use MySQL/ MariaDB instead of SQLite!
> If you want to use Redis make sure to read the [Redis guide](https://pelican.dev/docs/panel/advanced/redis/) first.
