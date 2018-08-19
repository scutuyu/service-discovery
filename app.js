const httpProxy = require('http-proxy')
const express = require('express')
const zookeeper = require("node-zookeeper-client")
const async = require('async')
const { ZOOKEEPER_CONNECT_STRING, SERVER_PORT, SERVICE_ROOT_PATH } = require('./src/conf/AppConfig')

// 缓存zk服务器上的服务提供者的地址
var cache = {}
var zk = zookeeper.createClient(ZOOKEEPER_CONNECT_STRING, {
    sessionTimeout: 5000
})

// 同步执行，先连上zk服务器，再启动web服务器
async.series([
    (callback) => {
        zk.connect()
        console.log('connecting to zk server: %s ...', ZOOKEEPER_CONNECT_STRING); 
        zk.once('connected', () => {
            console.log('connecte to zk server: %s sucess...', ZOOKEEPER_CONNECT_STRING); 
            callback(null, null)
        })
    },
    (callback) => {
        console.log('second method...');
        webServer()
        callback(null, null)
    }
], (err, result) => {
    // 回调...
})

function webServer(){
    var app = new express()
    var proxy = httpProxy.createProxyServer()
    app.use(express.static('public'))
        app.all('*', (req, res) => {
            console.log("---> path", req.path);
            
            if(req.path == '/favicon.ico'){
                res.end()
                return;
            }
            var serviceName = req.get('Service-Name')
            console.log('current cache: %s', JSON.stringify(cache));
            
            if(cache[serviceName]){
                console.log('cached, use cache');
                
                // 如果缓存中有服务提供者，直接使用，不用查询zookeeper
                proxy.web(req, res, {
                    target: 'http://' + cache[serviceName]
                }, (err) => {
                    // 服务不可用时，清除缓存
                    res.status(500).send({
                        msg: 'server is not available',
                        sucess: false
                    })
                    delete cache[serviceName]
                    console.log('proxy error, so clear the cache: %s', JSON.stringify(cache));
                    
                })
            }else{
                console.log('no cache, so connect to zk');
                
                var zkPath = SERVICE_ROOT_PATH + '/' + serviceName
                // 查找serviceName目录下的所有服务提供者，即所有子节点
                console.log('visit path: %s', zkPath);
                
                zk.getChildren(zkPath, (err, data) => {
                    if(err || data.length == 0){
                        console.error("no service provider for: %s", serviceName);
                        res.status(500).send({
                            'msg': 'no service provider',
                            'success': false
                        })
                        return;
                    }
        
                    // data是该目录下的所有子节点,随机选择某个子节点
                    var providerPath = zkPath + '/' + data[parseInt(Math.random() * data.length)]
                    console.log('get data of %s', providerPath);
                    
                    zk.getData(providerPath, (err, data) => {
                        if(err){
                            var msg = 'get provider address error'
                            console.error(msg);
                            res.json({'msg': msg})
                            return;
                        }
                        // 将查询到的提供者的地址缓存到cache中
                        cache[serviceName] = data
                        console.log('get data: %s and cache it: %s', data, JSON.stringify(cache));
                        
                        // 将请求代理到目标服务器
                        proxy.web(req, res, {
                            target: 'http://' + data
                        }, (err) => {
                            // 代理失败，服务提供者不能提供服务，删除缓存
                            delete cache[serviceName]
                            console.log('proxy error, so clear the cache: %s', JSON.stringify(cache));
                        })
                    })
                    
                })
            }
        })
        app.listen(SERVER_PORT, () => {
            console.log('server start at: %d', SERVER_PORT);
            
        })
}