const fs = require("fs");
let path = require("path");
require("dotenv").config();
const request = require("request");
const COS = require("cos-nodejs-sdk-v5");
const progressBar = require("@jyeontu/progress-bar");
const SingletonCreator = require("./singleton");

const config = {
  duration: 100,
  current: 0,
  block: "█",
  showNumber: true,
  tip: {
    0: "努力加载中……",
    50: "加载一半啦，不要着急……",
    75: "马上就加载完了……",
    100: "加载完成",
  },
  color: "blue",
};
let timer;
let progress = new progressBar(config);

let filesList = [];
function listFile(dir) {
  let mapList = fs.readdirSync(dir);
  mapList.map((item) => {
    let fullPath = path.join(dir, item);
    let stats = fs.statSync(fullPath);
    if (stats.isDirectory()) {
      listFile(fullPath);
    } else {
      filesList.push(fullPath);
    }
  });
  return filesList;
}

const files = listFile("./dist");
const filterFiles = files
  .filter((item) => !/\.css/.test(item))
  .map((item) => ({
    Bucket: process.env.Bucket /* 填入您自己的存储桶，必须字段 */,
    Region: process.env.Region /* 存储桶所在地域，例如 ap-beijing，必须字段 */,
    Key: item /* 存储在桶里的对象键（例如1.jpg，a/b/test.txt），必须字段 */,
    FilePath: `${item}` /* 必须 */,
    onTaskReady: function (taskId) {
      /* taskId 可通过队列操作来取消上传 cos.cancelTask(taskId)、停止上传 cos.pauseTask(taskId)、重新开始上传 cos.restartTask(taskId) */
      console.log(taskId, "taskId");
    },
  }));

const singleUpload = SingletonCreator(COS);

const CosUploader = new singleUpload({
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
        if (!data || !credentials) return console.error("credentials invalid");
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

CosUploader.uploadFiles(
  {
    files: filterFiles,
    SliceSize: 1024 * 1024 * 10 /* 设置大于10MB采用分块上传 */,
    onProgress: function (info) {
      let percent = parseInt(info.percent * 10000) / 100;
      let speed = parseInt((info.speed / 1024 / 1024) * 100) / 100;
      console.log("进度：" + percent + "%; 速度：" + speed + "Mb/s;");
      progress.run(percent);
    },
    onFileFinish: function (err, data, options) {
      console.log(options.Key + "上传" + (err ? "失败" : "完成"));
    },
  },
  function (err, data) {
    console.log(err || data);
  }
);
