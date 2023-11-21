---
title: softmax image classfication 2
tags: [pytorch]
date: 2023-11-19 01:00:00
categories: [pytorch]
excerpt: ai基础知识补习
---



```python
import torch
from torch import nn
from torch.utils import data
import torchvision
from torchvision import transforms
```


```python
batch_size = 256
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
train_iter, test_iter = load_data_fashion_mnist(256)
```


```python
net = nn.Sequential(nn.Flatten(), nn.Linear(784,10))
def init_weights(m):
    if type(m) == nn.Linear:
        nn.init.normal_(m.weight, std=0.01)
net.apply(init_weights)
net
```




    Sequential(
      (0): Flatten(start_dim=1, end_dim=-1)
      (1): Linear(in_features=784, out_features=10, bias=True)
    )




```python
loss = nn.CrossEntropyLoss(reduction='none')
trainer = torch.optim.SGD(net.parameters(), lr=0.1)
```


```python
num_epochs = 10
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
def evaluate_accuracy(net, data_iter):  
    """计算在指定数据集上模型的精度"""
    if isinstance(net, torch.nn.Module):
        net.eval()  # 将模型设置为评估模式
    metric = Accumulator(2)  # 正确预测数、预测总数
    with torch.no_grad():
        for X, y in data_iter:
            metric.add(accuracy(net(X), y), y.numel())
    return metric[0] / metric[1]

def train_epoch_ch3(net, train_iter, loss, updater):  #@save
    """训练模型一个迭代周期（定义见第3章）"""
    # 将模型设置为训练模式
    if isinstance(net, torch.nn.Module):
        net.train()
    # 训练损失总和、训练准确度总和、样本数
    metric = Accumulator(3)
    for X, y in train_iter:
        # 计算梯度并更新参数
        y_hat = net(X)
        l = loss(y_hat, y)
        if isinstance(updater, torch.optim.Optimizer):  # 这次就是true了
            # 使用PyTorch内置的优化器和损失函数
            updater.zero_grad()
            l.mean().backward()
            updater.step()
        else:
            # 使用定制的优化器和损失函数
            l.sum().backward()
            updater(X.shape[0])
        metric.add(float(l.sum()), accuracy(y_hat, y), y.numel())
    # 返回训练损失和训练精度
    return metric[0] / metric[2], metric[1] / metric[2]

```


```python
def train_ch3(net, train_iter, test_iter, loss, num_epochs, updater):  #@save
    """训练模型（定义见第3章）"""
    for epoch in range(num_epochs):
        train_metrics = train_epoch_ch3(net, train_iter, loss, updater)
        train_loss, train_acc = train_metrics
        print(f'epoch {epoch + 1}, loss {train_loss:f}, acc {train_acc:f}')
```


```python
train_ch3(net, train_iter, test_iter, loss, num_epochs, trainer)
```

    epoch 1, loss 0.786900, acc 0.750100
    epoch 2, loss 0.569765, acc 0.813767
    epoch 3, loss 0.523460, acc 0.826400
    epoch 4, loss 0.501842, acc 0.830967
    epoch 5, loss 0.484808, acc 0.836317
    epoch 6, loss 0.473122, acc 0.840633
    epoch 7, loss 0.465168, acc 0.842500
    epoch 8, loss 0.457948, acc 0.844433
    epoch 9, loss 0.452464, acc 0.847283
    epoch 10, loss 0.447432, acc 0.847467

