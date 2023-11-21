---
title: ResNet
tags: [pytorch]
date: 2023-11-21 00:00:00
categories: [pytorch]
excerpt: ai基础知识补习
---


### Residual Block作用：

总之，添加的新网络层至少不会使效果比原来差，就可以较为稳定地通过加深层数来提高模型的效果了。

### 为什么可以避免梯度消失：

求梯度，根据链式法则需要一直向前累乘，只要其中的任何一个因数过小就会导致求出来的梯度很小很小，这个小梯度就算乘以再大的学习率也是无济于事

有了残差边管通过链式法则走正常路线得到的梯度多么小，两条路线相加的结果都不会小


```python
from torch.utils import data
import torchvision
from torchvision import transforms
import torch
from torch import nn
from torch.nn import functional as F
from tqdm import tqdm
import time
```


```python
class Residual(nn.Module): 
    def __init__(self, input_channels, num_channels, use_1x1conv=False, strides=1):
        super().__init__()
        self.conv1 = nn.Conv2d(input_channels, num_channels, kernel_size=3, padding=1, stride=strides)
        self.conv2 = nn.Conv2d(num_channels, num_channels, kernel_size=3, padding=1)
        if use_1x1conv:
            self.conv3 = nn.Conv2d(input_channels, num_channels, kernel_size=1, stride=strides)
        else:
            self.conv3 = None
        self.bn1 = nn.BatchNorm2d(num_channels)
        self.bn2 = nn.BatchNorm2d(num_channels)

    def forward(self, X):
        Y = F.relu(self.bn1(self.conv1(X)))
        Y = self.bn2(self.conv2(Y))
        if self.conv3:
            X = self.conv3(X)
        Y += X
        return F.relu(Y)
```


```python
b1 = nn.Sequential(nn.Conv2d(1, 64, kernel_size=7, stride=2, padding=3),
                   nn.BatchNorm2d(64), nn.ReLU(),
                   nn.MaxPool2d(kernel_size=3, stride=2, padding=1))
```


```python
def resnet_block(input_channels, num_channels, num_residuals,
                 first_block=False):
    blk = []
    for i in range(num_residuals):
        if i == 0 and not first_block:
            blk.append(Residual(input_channels, num_channels,
                                use_1x1conv=True, strides=2))
        else:
            blk.append(Residual(num_channels, num_channels))
    return blk
```


```python
b2 = nn.Sequential(*resnet_block(64, 64, 2, first_block=True))
b3 = nn.Sequential(*resnet_block(64, 128, 2))
b4 = nn.Sequential(*resnet_block(128, 256, 2))
b5 = nn.Sequential(*resnet_block(256, 512, 2))
```


```python
net = nn.Sequential(b1, b2, b3, b4, b5,
                    nn.AdaptiveAvgPool2d((1,1)),
                    nn.Flatten(), nn.Linear(512, 10))
```


```python
lr, num_epochs, batch_size = 0.05, 10, 256
```


```python
def get_dataloader_workers():  #@save
    return 4
def load_data_fashion_mnist(batch_size, resize=None): 
    trans = [transforms.ToTensor()]
    if resize:
        trans.insert(0, transforms.Resize(resize))
    trans = transforms.Compose(trans)
    mnist_train = torchvision.datasets.FashionMNIST(
        root="./data", train=True, transform=trans, download=True)
    mnist_test = torchvision.datasets.FashionMNIST(
        root="./data", train=False, transform=trans, download=True)
    return (
            data.DataLoader(mnist_train, batch_size, shuffle=True, num_workers=get_dataloader_workers()), 
            data.DataLoader(mnist_test, batch_size, shuffle=False, num_workers=get_dataloader_workers())
           )

# 不重要，不用看
class Accumulator:  
    """在n个变量上累加"""
    def __init__(self, n):
        self.data = [0.0] * n

    def add(self, *args):
        self.data = [a + float(b) for a, b in zip(self.data, args)]

    def reset(self):
        self.data = [0.0] * len(self.data)

    def __getitem__(self, idx):
        return self.data[idx]
def accuracy(y_hat, y):  #@save
    """计算预测正确的数量"""
    if len(y_hat.shape) > 1 and y_hat.shape[1] > 1:
        y_hat = y_hat.argmax(axis=1)
    cmp = y_hat.type(y.dtype) == y
    return float(cmp.type(y.dtype).sum())
def evaluate_accuracy(net, data_iter,device):  
    """计算在指定数据集上模型的精度"""
    if isinstance(net, torch.nn.Module):
        net.eval()  # 将模型设置为评估模式
    metric = Accumulator(2)  # 正确预测数、预测总数
    with torch.no_grad():
        for X, y in data_iter:
            X,y = X.to(device), y.to(device)
            metric.add(accuracy(net(X), y), y.numel())
    return metric[0] / metric[1]

def train_ch6(net, trian_iter, test_iter, num_epochs, lr, device):
    def init_weights(m):
        if type(m)==nn.Linear or type(m)==nn.Conv2d:
            nn.init.xavier_uniform_(m.weight)
    net.apply(init_weights)
    print('training on' , device)

    optimizer = torch.optim.SGD(net.parameters(), lr=lr)
    loss = nn.CrossEntropyLoss()
    for epoch in range(num_epochs):
        metric = Accumulator(3)
        net = net.to(device)
        net.train()
        for i, (X,y) in tqdm(enumerate(train_iter)):
            start = time.time()
            optimizer.zero_grad() # 上一轮的梯度归零
            X,y = X.to(device), y.to(device)
            y_hat = net(X)
            l = loss(y_hat,y)
            l.backward() # 反向传播得到每个参数的梯度
            optimizer.step() # 参数更新
            with torch.no_grad():
                metric.add(l * X.shape[0], accuracy(y_hat,y), X.shape[0])
            train_l = metric[0] / metric[2]
            train_acc = metric[1] / metric[2]
            test_acc = evaluate_accuracy(net, test_iter,device)
        print(f'loss {train_l:.3f}, train acc {train_acc:.3f},' f'test acc {test_acc:.3f}')
```


```python
train_iter, test_iter = load_data_fashion_mnist(batch_size,resize=224)
print(len(train_iter),len(test_iter))
```


```python
train_ch6(net, train_iter, test_iter, num_epochs, lr, 'cuda:0')
```

```
loss 1.786, train acc 0.364,test acc 0.546
loss 0.864, train acc 0.680,test acc 0.761
loss 0.597, train acc 0.778,test acc 0.782
loss 0.500, train acc 0.817,test acc 0.731
loss 0.431, train acc 0.840,test acc 0.827
loss 0.391, train acc 0.855,test acc 0.847
loss 0.364, train acc 0.864,test acc 0.803
loss 0.334, train acc 0.875,test acc 0.857
loss 0.878, train acc 0.694,test acc 0.850
loss 0.352, train acc 0.869,test acc 0.862

loss 0.329, train acc 0.879,test acc 0.877
loss 0.297, train acc 0.889,test acc 0.859
loss 0.281, train acc 0.896,test acc 0.873
loss 0.265, train acc 0.902,test acc 0.886
loss 0.255, train acc 0.906,test acc 0.878
loss 0.243, train acc 0.910,test acc 0.892
```

