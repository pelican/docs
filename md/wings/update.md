# Updating Wings

> Update Wings with the built-in self-updater or by replacing the binary manually, then restart the service. Running servers are not affected.

Source: https://pelican.dev/docs/wings/update/

Updating Wings is a painless process and should take less than a minute to complete.

## Wings Version Requirements

| Panel Version | Wings Version | Supported |
|:-------------:|:-------------:|:---------:|
|      1.x      |      1.x      |    ✅︎     |

## Download Update

> **Tip**
>
> Running servers **will not** be affected.

### Self-update

First, run the Wings auto-updater.

```sh
sudo wings update
```

### Manual update

First, download the updated wings binary into `/usr/local/bin`. You will need to stop Wings briefly.

```sh
sudo systemctl stop wings
sudo curl -L -o /usr/local/bin/wings "https://github.com/pelican/wings/releases/latest/download/wings_linux_$([[ "$(uname -m)" == "x86_64" ]] && echo "amd64" || echo "arm64")"
sudo chmod u+x /usr/local/bin/wings
```

## Restart

Secondly, Restart the process.

```sh
sudo systemctl restart wings
```
