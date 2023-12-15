---
title: AlexNet
tags: [pytorch]
date: 2023-11-20 00:00:00
categories: [pytorch]
excerpt: ai基础知识补习
---

用的是fashion mnist


```python
import torch
from torch import nn
from torch.utils import data
import torchvision
from torchvision import transforms
import time
from tqdm import tqdm
```


```python
batch_size = 1024 # 书上写的128
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
train_iter, test_iter = load_data_fashion_mnist(batch_size,resize=224)
print(len(train_iter),len(test_iter))
```

    59 10



```python
# AlexNet
net = nn.Sequential(
    nn.Conv2d(1,96,kernel_size=11,stride=4,padding=1),
    nn.ReLU(),
    nn.MaxPool2d(kernel_size=3, stride=2),
    nn.Conv2d(96, 256, kernel_size=5, padding=2), 
    nn.ReLU(),
    nn.MaxPool2d(kernel_size=3, stride=2),
    nn.Conv2d(256, 384, kernel_size=3, padding=1), 
    nn.ReLU(),
    nn.Conv2d(384, 384, kernel_size=3, padding=1), 
    nn.ReLU(),
    nn.Conv2d(384, 256, kernel_size=3, padding=1),
    nn.ReLU(),
    nn.MaxPool2d(kernel_size=3, stride=2),
    nn.Flatten(),
    nn.Linear(6400, 4096), 
    nn.ReLU(),
    nn.Dropout(p=0.5),
    nn.Linear(4096, 4096), 
    nn.ReLU(),
    nn.Dropout(p=0.5),
    nn.Linear(4096, 10))
```


```python
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
```


```python
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
        print(f'{metric[2] * num_epochs / ( time.time() - start ) :.1f} examples/sec '  f'on {str(device)}')
```


```python
lr, num_epochs = 0.01, 10
train_ch6(net, train_iter, test_iter, num_epochs, lr, 'cuda:0')
```

    training on cuda:0


    59it [02:46,  2.83s/it]
    
    loss 2.283, train acc 0.256,test acc 0.328
    211869.9 examples/sec on cuda:0


​    
​    59it [02:48,  2.86s/it]
​    
​    loss 1.832, train acc 0.430,test acc 0.549
​    230051.2 examples/sec on cuda:0


​    
​    59it [02:52,  2.92s/it]
​    
​    loss 1.085, train acc 0.596,test acc 0.598
​    233088.3 examples/sec on cuda:0


​    
​    59it [02:44,  2.79s/it]
​    
​    loss 0.885, train acc 0.666,test acc 0.701
​    221954.7 examples/sec on cuda:0


​    
​    59it [02:41,  2.74s/it]
​    
​    loss 0.787, train acc 0.703,test acc 0.743
​    226613.6 examples/sec on cuda:0


​    
​    59it [02:46,  2.82s/it]
​    
​    loss 0.712, train acc 0.730,test acc 0.738
​    214793.3 examples/sec on cuda:0


​    59it [02:50,  2.90s/it]
​    

    loss 0.668, train acc 0.751,test acc 0.727
    228293.3 examples/sec on cuda:0


​    53it [02:28,  2.83s/it]