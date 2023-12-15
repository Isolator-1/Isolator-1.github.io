---
title: patchelf修改libc版本
tags: [ctf-pwn]
date: 2022-11-27 16:00:00
categories: [ctf-pwn]
excerpt: 修改libc版本
---

#### 安装glibc-all-in-one

```shell
git clone https://github.com/matrix1001/glibc-all-in-one
cd glibc-all-in-one
./update_list
cat list 
./download <libc-in-list>
```

#### 修改libc.so和ld.so

```sh
patchelf --set-interpreter ./glibc-all-in-one/libs/2.23-0ubuntu3_amd64/ld-2.23.so  <path-to-elf>

patchelf --replace-needed libc.so.6 ./glibc-all-in-one/libs/2.23-0ubuntu3_amd64/libc.so.6  <path-to-elf>
# param1 : old libc.so
# param2 : new libc.so
# param3 : path to elf
```



#### 效果图

![](/img/patchelf/1.png)

