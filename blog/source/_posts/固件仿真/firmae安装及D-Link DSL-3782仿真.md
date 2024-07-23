---
title: firmae安装及D-Link DSL-3782仿真
tags: [firmware analysis]
date: 2023-09-14 10:00:00
categories: [固件仿真]
excerpt: CVE-2023-27216
---

### FirmAE安装

```https://github.com/pr0v3rbs/FirmAExu```

需要注意的点：

1. git clone时记得recursive，不能git clone就把 routersploit这个库复制到```./analysis```里
2. `download.sh`里的下载最好自己下来复制到`./binaries`里
3. `install.sh`中 open-jdk-8和fusecram没法直接从apt安装（暂时当它不存在）

### DLink DSL-3782漏洞复现

固件地址：<https://media.dlink.eu/support/products/dsl/dsl-3782/driver_software/dsl-3782_a1_eu_1.01_07282016.zip>

参考方法：https://bbs.kanxue.com/thread-278413.htm

先直接把固件跑起来，抄一下exp试一试：

![](/img/固件仿真/CVE-2023-27216/1.jpg)

#### **漏洞原理**

