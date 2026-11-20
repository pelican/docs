# Change Panel Domain

> Move the Pelican Panel to a new domain by updating the webserver config, APP_URL in .env and the remote URL in each node's Wings config.

Source: https://pelican.dev/docs/guides/change-panel-domain/

Moving the Panel to a new domain means changing it in three places: your webserver config, `APP_URL` in the Panel's `.env` file, and the remote URL in each node's Wings config.

## Webserver & Panel

First you need to modify the server name in your web server config.

### Nginx

```sh
sudo nano /etc/nginx/sites-available/pelican.conf
# Search for "server_name"
```

> **Info: Using HTTPS?**
>
> If you're using HTTPS, remember to also change the SSL paths in the config file to match your new domain and [generate a new certificate](https://pelican.dev/docs/guides/ssl/).

### Apache

```sh
sudo nano /etc/apache2/sites-available/pelican.conf
# Search for "ServerName"
```

> **Info: Using HTTPS?**
>
> If you're using HTTPS, remember to also change the SSL paths in the config file to match your new domain and [generate a new certificate](https://pelican.dev/docs/guides/ssl/).

### Caddy

```sh
sudo nano /etc/caddy/Caddyfile
```

Next, modify the `APP_URL` in the `.env` file located at `/var/www/pelican` by typing `sudo nano /var/www/pelican/.env`.

Finally, restart your webserver to apply the changes.

### Nginx

```sh
sudo systemctl restart nginx
```

### Apache

```sh
sudo systemctl restart apache2
```

### Caddy

```sh
sudo systemctl restart caddy
```

## Nodes

The wings config file for each node must be updated to match the new Panel URL. (`remote` field)

You can do it manually in the `config.yml` file located at `/etc/pelican` or overwrite it completely by copying it from the Panel.

Make sure to restart wings (`sudo systemctl restart wings`) after updating the wings config file.
