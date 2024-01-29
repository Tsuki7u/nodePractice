// 引入 express 框架 -> 需 npm 安装
var express = require("express");
const fs = require("fs");

/**
 * 初始化框架,并将初始化后的函数给予 '当前页面'全局变量 app
 * 也就是说, app 是 express
 */
var app = express();
app.all("*", function (req, res, next) {
  //设置允许跨域的域名，*代表允许任意域名跨域
  res.header("Access-Control-Allow-Origin", "*");
  //允许的header类型
  res.header("Access-Control-Allow-Headers", "content-type");
  //跨域允许的请求方式
  res.header("Access-Control-Allow-Methods", "DELETE,PUT,POST,GET,OPTIONS");
  if (req.method.toLowerCase() == "options")
    res.send(200); //让options尝试请求快速结束
  else next();
});

/* 配置框架环境 S */
const request = require("request");
const COS = require("cos-nodejs-sdk-v5");

// 设置 public 为静态文件的存放文件夹
app.use("/public", express.static("public"));

/* 配置框架环境 E */
app.get("/getCos", function (req, res) {
  const data = { message: "上传文件" };
  const files = fs.readdirSync("./dist");
  const filterFiles = files
    .filter((item) => !/\.css/.test(item))
    .map((item) => ({
      Bucket: "examplebucket-1250000000" /* 填入您自己的存储桶，必须字段 */,
      Region: "COS_REGION" /* 存储桶所在地域，例如 ap-beijing，必须字段 */,
      Key: item /* 存储在桶里的对象键（例如1.jpg，a/b/test.txt），必须字段 */,
      FilePath: `./dist/${item}` /* 必须 */,
      onTaskReady: function (taskId) {
        /* taskId 可通过队列操作来取消上传 cos.cancelTask(taskId)、停止上传 cos.pauseTask(taskId)、重新开始上传 cos.restartTask(taskId) */
        console.log(taskId, 'taskId');
      },
      // 支持自定义headers 非必须
      Headers: {
        "x-cos-meta-test": 123,
      },
    }));
  console.log(filterFiles, "files");
  const cos = new COS({
    getAuthorization: function (options, callback) {
      // 初始化时不会调用，只有调用 cos 方法（例如 cos.putObject）时才会进入
      // 异步获取临时密钥
      request(
        {
          url: "https://example.com/sts", // 替换为自己的获取临时密钥的服务url
          data: {
            // 可从 options 取需要的参数
          },
        },
        function (err, response, body) {
          let data = null;
          let credentials = null;
          try {
            data = JSON.parse(body);
            credentials = data.credentials;
          } catch (e) {}
          if (!data || !credentials)
            return console.error("credentials invalid");
          callback({
            TmpSecretId: credentials.tmpSecretId, // 临时密钥的 tmpSecretId
            TmpSecretKey: credentials.tmpSecretKey, // 临时密钥的 tmpSecretKey
            SecurityToken: credentials.sessionToken, // 临时密钥的 sessionToken
            // 建议返回服务器时间作为签名的开始时间，避免用户浏览器本地时间偏差过大导致签名错误
            StartTime: data.startTime, // 时间戳，单位秒，如：1580000000
            ExpiredTime: data.expiredTime, // 临时密钥失效时间戳，是申请临时密钥时，时间戳加 durationSeconds
          });
        }
      );
    },
  });
  cos.uploadFiles(
    {
      files: filterFiles,
      SliceSize: 1024 * 1024 * 10 /* 设置大于10MB采用分块上传 */,
      onProgress: function (info) {
        var percent = parseInt(info.percent * 10000) / 100;
        var speed = parseInt((info.speed / 1024 / 1024) * 100) / 100;
        console.log("进度：" + percent + "%; 速度：" + speed + "Mb/s;");
      },
      onFileFinish: function (err, data, options) {
        console.log(options.Key + "上传" + (err ? "失败" : "完成"));
      },
    },
    function (err, data) {
      console.log(err || data);
    }
  );
  return res.json(data);
});

var server = app.listen(8081);
