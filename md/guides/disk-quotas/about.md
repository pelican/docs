# About Quotas

> Read the warnings and requirements before enabling filesystem disk quotas for Pelican server data, which are still a work in progress.

Source: https://pelican.dev/docs/guides/disk-quotas/about/

Disk quotas let the filesystem limit how much space each server's files can use. Support for them in Pelican is still a work in progress, so read the notices on this page before you enable them.

> **Tip**
>
> As called out in the Wings install docs, it is always recommended to keep the server files on a separate partition.

## There are a lot of notices here for a reason!

> **Danger**
>
> Support for disk quotas is still being worked on!

> **Warning**
>
> These are advanced configurations meant for hosts but "should" work for individuals as well.

> **Warning**
>
> Depending on the filesystem Quotas can be difficult to enable for the `/` mount, which requires booting a live disk to change.

> **Info**
>
> You can either make a new mount with quotas enabled or enable quotas on an existing partition.

## Filesystem-specific docs
[EXT4/XFS](https://pelican.dev/docs/guides/disk-quotas/ext4-xfs/)
