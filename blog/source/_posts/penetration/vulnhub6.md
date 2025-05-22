---
title: vulnhub 做题 Noob:1
tags: [penetration]
date: 2024-10-16 00:00:01
categories: [penetration]
excerpt: day5
---

## Vulnhub 做题 Noob:1

### 扫描

```zsh
21/tcp    open  ftp     vsftpd 3.0.3
80/tcp    open  http    Apache httpd 2.4.29 ((Ubuntu))
55077/tcp open  ssh     OpenSSH 7.6p1 Ubuntu 4ubuntu0.5 (Ubuntu Linux; protocol 2.0)
```

这个vsftpd 3.0.3只搜到了一个Dos攻击，没啥用，80端口的web是个登陆界面，扫了半天资源路径啥也没扫出来，ssh尝试枚举用户名也没弄明白

### 利用

学习一下如何ftp链接：

如果直接`ftp ip`，会让你直接输入用户名密码，但是并不是所有ftp都需要用户密码才能登陆，比如匿名ftp

只需要在输入用户名密码时，输入用户名为anonymous，密码空着，就能登录匿名ftp服务器

此外，`ftp ftp://ip`这样也可以直接登录上去

这道题的ftp就是一个匿名的，登陆上去之后有两个文件，get下来

```zsh
-rw-r--r--    1 0        0              21 Sep 21  2021 cred.txt
-rw-r--r--    1 0        0              86 Jun 11  2021 welcome
└─$ cat cred.txt 
Y2hhbXA6cGFzc3dvcmQ=                                                               
└─$ cat welcome 
                        🙏 WELCOME 🙏
                  We're glad to see you here.
                      💪 All The Best 👍
```

base64解密出来：champ:password，这个东西既不是ftp的账号，也不是ssh的账号，web倒是登上去了，web只有一个功能，下载下来一个bmp、一个jpg、一个叫做sudo的文本

```zsh
┌──(kali㉿kali)-[~/Downloads/downloads]
└─$ stegseek funny.jpg  /usr/share/wordlists/rockyou.txt 
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: ""
[i] Original filename: "hint.py".
[i] Extracting to "funny.jpg.out".
                                                                                                    
┌──(kali㉿kali)-[~/Downloads/downloads]
└─$ cat funny.jpg.out 
This is_not a python file but you are revolving around.
well, try_ to rotate some words too.
```

```zsh
┌──(kali㉿kali)-[~/Downloads/downloads]
└─$ stegseek funny.bmp  /usr/share/wordlists/dirbuster/directory-list-1.0.txt 
StegSeek 0.6 - https://github.com/RickdeJager/StegSeek

[i] Found passphrase: "sudo"
[i] Original filename: "user.txt".
[i] Extracting to "funny.bmp.out".
                            
┌──(kali㉿kali)-[~/Downloads/downloads]
└─$ cat funny.bmp.out 
jgs:guvf bar vf n fvzcyr bar
```

bmp试了好几个字典，试出来发现是sudo，而下载下来的sudo里面说“文件名很有趣”，应该就是在暗示这个密码。然后结合jpg揭秘出来的说要rotate，不知道多少位

但是一搜在线解密，就有一个rotate13的解密网站，解密出来：`wtf:this one is a simple one`
(是因为13是26的一半，所以大家更倾向于13么😶‍🌫️)

那这个也只能是ssh的帐号了（第一次知道ssh的密码可以带空格）

登上去之后，非常搞的一件事是这个wtf可以直接sudo su😅😅😅

```zsh
root@wtf:~# cat root.txt 
RW5kb3JzZSBtZSBvbiBsaW5rZWRpbiA9PiBodHRwczovL3d3dy5saW5rZWRpbi5jb20vaW4vZGVlcGFrLWFoZWVyCg==

Follow me on Twitter https://www.twitter.com/Deepakhr9

TryHackMe --> https://www.tryhackme.com/p/Malwre99
Github --> https://www.github.com/Deepak-Aheer
(the flag is my LinkedIn username)


        THANK YOU for PLAYING THIS CTF

        But REMEMBER we're still N00bs ;)
```


但是还是按照出题者的想法继续往下做一做（

在wtf用户下，/home/roooot里面有一个flag.txt，但是是个假的 （别问咋找到的，问就是看了题解😶‍🌫️）

```zsh
wtf@wtf:/home/rooot$ cat flag.txt 
A Rabbit Hole?
Not sure!

Well, look for the thing you want.
It's just 2 steps ahead :)
```

然后在Downloads下又找到了一个`flag-1.txt`，`VGhlIGZsYWcgaXMgdGhlIGVuY29kZWQgc3RyaW5nIGl0c2VsZg`，解密`The flag is the encoded string itself`，意思是这个加密过后的就是真的flag

然后Documents下还有一个东西（别问，问就是看了题解😶‍🌫️）

```shell
REMOTE=1.2.3.4
SOURCE=/home/rooot
TARGET=/usr/local/backup
LOG=/home/rooot/bck.log 
DATE=`date +%y\.%m\.%d\.`
USER=n00b
#aw3s0m3p@$$w0rd

ssh $USER@$REMOTE mkdir $TARGET/$DATE

if [ -d "$SOURCE" ]; then
    for i in `ls $SOURCE | grep 'data'`;do
             echo "Begining copy of" $i  >> $LOG
             scp  $SOURCE/$i $USER@$REMOTE:$TARGET/$DATE
             echo $i "completed" >> $LOG

                if [ -n `ssh $USER@$REMOTE ls $TARGET/$DATE/$i 2>/dev/null` ];then
                    rm $SOURCE/$i
                    echo $i "removed" >> $LOG
                    echo "####################" >> $LOG
                                else
                                        echo "Copy not complete" >> $LOG
                                        exit 0
                fi 
    done    
else
    echo "Directory is not present" >> $LOG
    exit 0
fi
```

也不知道这玩意是干啥的，上来先一个ssh链接，但是ip瞎写的，就算改成靶机ip，也因为没有那个backup路径执行失败，不管了，反正能看出来给了n00b的密码

登陆上去，这回root不了了😅，sudo -l发现 /bin/nano 是可以root执行的

搜了一下nano的提权漏洞

首先执行sudo nano，然后ctrl r，ctrl x，进入一个输入命令执行的界面

然后输入`reset; sh 1>&0 2>&0` 回车，就拿到了一个root的shell
