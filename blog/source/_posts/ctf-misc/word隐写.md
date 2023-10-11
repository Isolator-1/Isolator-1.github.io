---
title: word隐写 
tags: [ctf-misc]
date: 2023-10-10 18:04:00
categories: [ctf-misc]
excerpt: word隐写与ppt隐写
---

### word隐写

.docx文件改后缀为.zip

里面全是xml文件，如下图

用vscode打开xml时可以用`shift alt f`进行格式整理（需要装一个xml formatter）

![](/img/steganography/1.jpg)

例如上图中的题目是在document.xml里放了一段密文

ppt同理