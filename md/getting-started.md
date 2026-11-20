# Getting Started

> What a Pelican server needs and the one-command install: requirements, the virtualization check, installing Docker, starting it on boot and enabling swap.

Source: https://pelican.dev/docs/getting-started/

Pelican runs on a dedicated Linux server, and the recommended way to install it is with **Docker**.
The quickest way there is the install script below; this page also covers getting Docker ready yourself, if you'd rather [install the Panel](https://pelican.dev/docs/panel/install/) step by step.

> **Danger**
>
> **You should have some basic familiarity with Linux before you proceed!**

> **Tip: Coming from Pterodactyl?**
>
> You don't need a fresh install. Follow [Migrating from Pterodactyl](https://pelican.dev/docs/guides/migrating-from-pterodactyl/) to upgrade your existing Panel and keep all your data.

## Requirements

Pelican runs on a wide range of operating systems, so pick whichever you are most comfortable using,
as long as it supports [Docker Engine](https://docs.docker.com/engine/install/).

Docker may not work under `OpenVZ`, `Virtuozzo` or `LXC` virtualization unless your provider has configured it for nested containers.
`kvm` and bare metal (`none`) work without issues. To check what your server uses, run:

```sh
systemd-detect-virt
```

If that command isn't available, `sudo dmidecode -s system-manufacturer` usually tells you as well.

A domain (or subdomain) for the Panel, such as `panel.example.com` with an `A` record pointing at your server, gives it HTTPS. It's optional to start with: without one the Panel is served on your server's IP address, and you can add the domain later.

## The quick way: one command

On a fresh server, this installs Docker and starts the Panel on your server's IP address. Give it a domain and it sets up HTTPS with Let's Encrypt too:

```sh
# On your server's IP
curl -fsSL https://pelican.dev/install.sh | sudo bash

# On your domain, with HTTPS
curl -fsSL https://pelican.dev/install.sh | sudo bash -s -- --domain panel.example.com --email you@example.com
```

It asks nothing; add `--interactive` to be asked about each choice (a domain, the simple or the production setup, Wings).

When it's done, open the address it shows (`http://<your server's IP>/installer`, or `https://<your domain>/installer`) to finish. [Installing the Panel](https://pelican.dev/docs/panel/install/#the-install-script) explains every option, what the script sets up and how to change it later. Want an AI assistant to walk you through it? See [Installing with an AI Assistant](https://pelican.dev/docs/guides/ai-assistant/).

The rest of this page sets up Docker by hand, for the [Docker Compose install](https://pelican.dev/docs/panel/install/#docker-compose) or for [Wings](https://pelican.dev/docs/wings/install/). The script does all of it for you.

## Installing Docker

For a quick install of Docker CE, you can use the command below:

```sh
curl -sSL https://get.docker.com/ | CHANNEL=stable sudo sh
```

That works on Ubuntu, Debian, Fedora, CentOS Stream and RHEL. On **AlmaLinux, Rocky Linux and Oracle Linux** it stops with "Unable to find a match: docker-ce": Docker's repos for them have no Docker Engine packages. Use Docker's CentOS repo instead, which has the same packages:

```sh
sudo curl -fsSL https://download.docker.com/linux/centos/docker-ce.repo -o /etc/yum.repos.d/docker-ce.repo
sudo dnf -y install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
```

Some cloud images leave out kernel modules Docker needs:

- On **CentOS Stream, AlmaLinux and Rocky Linux 10**, `xt_addrtype` is missing, so Docker installs but won't start.
- On **Oracle Linux** with its UEK kernel, `xt_ipvs` is missing, so Docker runs but Swarm can't reach its services (the Panel answers 502).

Install them, then restart Docker:

```sh
# CentOS Stream, AlmaLinux, Rocky Linux
sudo dnf -y install kernel-modules-extra-$(uname -r)
# Oracle Linux (UEK)
sudo dnf -y install kernel-uek-modules-extra-$(uname -r) kernel-uek-modules-extra-netfilter-$(uname -r)

sudo systemctl restart docker
```

If `sudo modprobe xt_addrtype` (or `xt_ipvs`) still can't find the module, the package was installed for a newer kernel than the one running: reboot and try again. The [install script](#the-quick-way-one-command) does all of this for you.

> **Info: Installing Docker CE**
>
> If none of this works on your server, see the [official Docker documentation](https://docs.docker.com/engine/install/) on how to install Docker CE.

## Start Docker on Boot

If you are on an operating system with systemd (Ubuntu 16+, Debian 8+, CentOS 7+) run the command below to have Docker start when you boot your machine.

```sh
sudo systemctl enable --now docker
```

## Enabling Swap

On most systems, Docker will be unable to setup swap space by default. You can confirm this by running `docker info` and looking for the output of `WARNING: No swap limit support` near the bottom.

Enabling swap is entirely optional, but we recommended doing it if you will be hosting for others and to prevent OOM errors.

To enable swap, open `/etc/default/grub` as a root user and find the line starting with `GRUB_CMDLINE_LINUX_DEFAULT`. Make
sure the line includes `swapaccount=1` somewhere inside the double-quotes.

After that, run `sudo update-grub` followed by `sudo reboot` to restart the server and have swap enabled.
Below is an example of what the line should look like, _do not copy this line verbatim. It often has additional OS-specific parameters._

```text
GRUB_CMDLINE_LINUX_DEFAULT="swapaccount=1"
```

> **Info: GRUB Configurations**
>
> Some Linux distros may ignore `GRUB_CMDLINE_LINUX_DEFAULT`.
> Therefore you might have to use `GRUB_CMDLINE_LINUX` instead should the above variable not work for you.

## Next Steps

Docker is ready. Continue to [Installing the Panel](https://pelican.dev/docs/panel/install/).

Prefer to run the Panel directly on your server without Docker? Follow the [standalone install](https://pelican.dev/docs/panel/standalone/getting-started/) instead.
