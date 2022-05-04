document.writeln("<!-- 搜索栏 -->");
document.writeln("<div id=\'search\'class=\'s-search\'>");
document.writeln("<div id=\'search-list\'class=\'hide-type-list\'>");

document.writeln("<div class=\'s-type\'>");
document.writeln("<span></span>");
document.writeln("<div class=\'s-type-list\'>");
document.writeln("<label for=\'type-baidu\'><span class=\'tile-lg\'><i class=\'fa fa-search fa-2x m-t-sm\'></i></span>默认</label><label for=\'type-xueshu\'><span class=\'tile-lg\'><i class=\'fa fa-book fa-2x m-t-sm\'></i></span>学术</label><label for=\'type-tupian\'><span class=\'tile-lg\'><i class=\'fa fa-file-image-o fa-2x m-t-sm\'></i></span>图片</label>");
document.writeln("<label for=\'type-yinle\'><span class=\'tile-lg\'><i class=\'fa fa-music fa-2x m-t-sm\'></i></span>音乐</label> <label for=\'type-gongju\'><span class=\'tile-lg\'><i class=\'fa fa-legal fa-2x m-t-sm\'></i></span>工具</label><label for=\'type-yinshi\'><span class=\'tile-lg\'><i class=\'fa fa-video-camera fa-2x m-t-sm\'></i></span>影视</label>");
document.writeln("<label for=\'type-shequ\'><span class=\'tile-lg\'><i class=\'fa fa-github fa-2x m-t-sm\'></i></span>社区</label><label for=\'type-sucai\'><span class=\'tile-lg\'><i class=\'fa fa-tree fa-2x m-t-sm\'></i></span>素材</label><label for=\'type-shenghuo\'><span class=\'tile-lg\'><i class=\'fa fa-coffee fa-2x m-t-sm\'></i></span>生活</label>");
document.writeln("</div>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-c\'>");
document.writeln("<span class=\'type-text\'>默认</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input checked hidden type=\'radio\'name=\'type\'id=\'type-baidu\'value=\'https://www.baidu.com/s?wd=\'data-placeholder=\'百度搜索\'><label for=\'type-baidu\'><span style=\'color:#003daa\'>百度</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-ciku\' value=\'https://cn.bing.com/search?q=\' data-placeholder=\'必应搜索\'><label for=\'type-ciku\'><span style=\'color:#003daa\'>必应</span></label></li>");
document.writeln("<li><input checked hidden type=\'radio\'name=\'type\'id=\'type-ditu\'value=\'https://ditu.amap.com/search?query=\'data-placeholder=\'高德地图\'><label for=\'type-ditu\'><span style=\'color:#003daa\'>地图</span></label></li>");
document.writeln("<li><input checked hidden type=\'radio\'name=\'type\'id=\'type-google2\'value=\'https://www.google.com/search?query=\'data-placeholder=\'谷歌搜索\'><label for=\'type-google2\'><span style=\'color:#003daa\'>Google</span></label></li>");
document.writeln("<li><input checked hidden type=\'radio\'name=\'type\'id=\'type-mijisou\'value=\'https://duckduckgo.com/?q=\'data-placeholder=\'DuckDuckGo\'><label for=\'type-mijisou\'><span style=\'color:#003daa\'>DuckDuckGo</span></label></li>");
document.writeln("<li><input hidden type=\"radio\" name=\"type\" id=\"type-github\" value=\"https://github.com/search?q=\" data-placeholder=\"Github\"><label for=\"type-github\"><span style=\'color:#003daa\'>Github</span></label></li>");
document.writeln("<li><input checked hidden type=\'radio\'name=\'type\'id=\'type-maji\'value=\'https://codepen.io/search/pens?q=\'data-placeholder=\'CodePen\'><label for=\'type-maji\'><span style=\'color:#003daa\'>CodePen</span></label></li>");
document.writeln("<li><input checked hidden type=\'radio\'name=\'type\'id=\'type-panduoduo\'value=\'https://3dwarehouse.sketchup.com/search/?q=\'data-placeholder=\'3D模型库搜索\'><label for=\'type-panduoduo\'><span style=\'color:#003daa\'>3DWarehouse</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-a s-current\'>");
document.writeln("<span class=\"type-text\">学术</span>");
document.writeln("<ul class=\"search-type\">");
document.writeln("<li><input hidden=\"\" type=\"radio\" name=\"type\" id=\"type-xueshu\" value=\"https://xueshu.baidu.com/s?wd=\" data-placeholder=\"百度学术\"><label for=\"type-xueshu\"><span style=\'color:#003daa\'>百度</span></label></li>");
document.writeln("<li><input hidden=\"\" type=\"radio\" name=\"type\" id=\"type-biyingxueshu\" value=\"https://bing.com/academic/search?q=\" data-placeholder=\"必应学术\"><label for=\"type-biyingxueshu\"><span style=\'color:#003daa\'>必应</span></label></li>");
document.writeln("<li><input hidden=\"\" type=\"radio\" name=\"type\" id=\"type-zhiwang\" value=\"https://kns.cnki.net/kns/brief/Default_Result.aspx?code=SCDB&amp;kw=\" data-placeholder=\"知网文献\"><label for=\"type-zhiwang\"><span style=\'color:#003daa\'>知网</span></label></li>");
document.writeln("<li><input hidden=\"\" type=\"radio\" name=\"type\" id=\"type-yingxiangyinzhi\" value=\"https://www.letpub.com.cn/index.php?page=journalapp&amp;view=search&amp;searchname=\" data-placeholder=\"SCI查询\"><label for=\"type-yingxiangyinzhi\"><span style=\'color:#003daa\'>影响因子</span></label></li>");
document.writeln("<li><input hidden=\"\" type=\"radio\" name=\"type\" id=\"type-xiaomuchou\" value=\"https://ctext.org/pre-qin-and-han/zh?searchu=\" data-placeholder=\"先秦两汉传统书籍全文检索\"><label for=\"type-xiaomuchou\"><span style=\'color:#003daa\'>国学检索</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-ping\' value=\'https://ctext.org/post-han/zh?searchu=\' data-placeholder=\'汉代之后传统书籍全文检索\'><label for=\'type-ping\'><span style=\'color:#003daa\'>传统文化</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-f\'>");
document.writeln("<span class=\'type-text\'>图片</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-tupian\' value=\'https://image.baidu.com/search/index?tn=baiduimage&amp;ps=1&amp;ct=201326592&amp;lm=-1&amp;cl=2&amp;nc=1&amp;ie=utf-8&amp;word=\' data-placeholder=\'搜索百度图片\'><label for=\'type-tupian\'><span style=\'color:#003daa\'>百度</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-BING\' value=\'https://bing.com/images/search?q=\' data-placeholder=\'必应图片搜索\'><label for=\'type-BING\'><span style=\'color:#003daa\'>必应</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-hellorf\' value=\'https://yandex.com/images/search?text=\' data-placeholder=\'雅虎图片搜索\'><label for=\'type-hellorf\'><span style=\'color:#003daa\'>雅虎</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-whyy\' value=\'https://unsplash.dogedoge.com/s/photos/\' data-placeholder=\'Unsplash图片搜索\'><label for=\'type-whyy\'><span style=\'color:#003daa\'>Unsplash</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-xiami\' value=\'https://www.pexels.com/zh-cn/search/\' data-placeholder=\'Pexels图片搜索\'><label for=\'type-xiami\'><span style=\'color:#003daa\'>Pexels</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-ape8\' value=\'https://pixabay.com/images/search/\' data-placeholder=\'Pixabay图片搜索\'><label for=\'type-ape8\'><span style=\'color:#003daa\'>Pixabay</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-500px\' value=\'https://500px.com/search?q=\' data-placeholder=\'500PX品质摄影社区\'><label for=\'type-500px\'><span style=\'color:#003daa\'>500PX</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-freebiesbug\' value=\'https://dribbble.com/search/\' data-placeholder=\'Dribbble的UI素材搜索\'><label for=\'type-freebiesbug\'><span style=\'color:#003daa\'>Dribbble</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-d\'>");
document.writeln("<span class=\'type-text\'>音乐</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-yinle\' value=\'https://music.163.com/#/search/m/?s=\' data-placeholder=\'网易云音乐\'><label for=\'type-yinle\'><span style=\'color:#003daa\'>云音乐</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-soundcloud\' value=\'https://www.kugou.com/yy/html/search.html#searchType=song&searchKeyWord=\' data-placeholder=\'酷狗音乐\'><label for=\'type-soundcloud\'><span style=\'color:#003daa\'>酷狗音乐</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-baidu-music\' value=\'https://music.91q.com/search?word=\' data-placeholder=\'千千音乐\'><label for=\'type-baidu-music\'><span style=\'color:#003daa\'>千千音乐</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-qq-music\' value=\'https://y.qq.com/portal/search.html#searchid=1&amp;remoteplace=txt.yqq.top&amp;t=song&amp;w=\' data-placeholder=\'QQ音乐\'><label for=\'type-qq-music\'><span style=\'color:#003daa\'>QQ音乐</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-e\'>");
document.writeln("<span class=\'type-text\'>工具</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-gongju\' value=\'https://translate.google.cn/?sl=auto&tl=zh-CN&text=\' data-placeholder=\'请输入英文\'><label for=\'type-gongju\'><span style=\'color:#003daa\'>Google翻译</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-links\' value=\'https://dict.baidu.com/s?wd=\' data-placeholder=\'请输入词语，成语，诗词\'><label for=\'type-links\'><span style=\'color:#003daa\'>百度汉语</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-icp\' value=\'https://flightaware.com/live/airport/\' data-placeholder=\'请输入航班或机场代码\'><label for=\'type-icp\'><span style=\'color:#003daa\'>航班跟踪</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-xiangha\' value=\'https://www.tianyancha.com/search?key=\' data-placeholder=\'请输入企业或法人名称\'><label for=\'type-xiangha\'><span style=\'color:#003daa\'>天眼查询</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-b\'>");
document.writeln("<span class=\'type-text\'>影视</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input hidden type=\'radio\'name=\'type\'id=\'type-yinshi\'value=\'https://www.manamana.net/Search?content=\'data-placeholder=\'MANA新媒体艺术搜索\'><label for=\'type-yinshi\'><span style=\'color:#003daa\'>MANA</span></label></li>");
document.writeln("<li><input hidden type=\'radio\'name=\'type\'id=\'type-Neets\'value=\'https://www.bbcearth.com/search?q=\'data-placeholder=\'搜索BBC地球\'><label for=\'type-Neets\'><span style=\'color:#003daa\'>BBC</span></label></li>");
document.writeln("<li><input hidden type=\"radio\" name=\"type\" id=\"type-bilibili\" value=\"https://search.bilibili.com/all?keyword=\" data-placeholder=\"哔哩哔哩\"><label for=\"type-bilibili\"><span style=\'color:#003daa\'>B站</span></label></li>");
document.writeln("<li><input hidden type=\'radio\'name=\'type\'id=\'type-bashi\'value=\'https://www.douyin.com/search/\'data-placeholder=\'抖音搜索\'><label for=\'type-bashi\'><span style=\'color:#003daa\'>抖音</span></label></li>");
document.writeln("<li><input hidden type=\'radio\'name=\'type\'id=\'type-fenghk\'value=\'https://www.kuaishou.com/search/video?searchKey=\'data-placeholder=\'快手搜索\'><label for=\'type-fenghk\'><span style=\'color:#003daa\'>快手</span></label></li>");
document.writeln("<li><input hidden type=\'radio\'name=\'type\'id=\'type-ckdiany\'value=\'https://v.qq.com/x/search/?q=\'data-placeholder=\'腾讯视频 \'><label for=\'type-ckdiany\'><span style=\'color:#003daa\'>腾讯</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-g\'>");
document.writeln("<span class=\'type-text\'>社区</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-shequ\' value=\'https://www.zhihu.com/search?type=content&amp;q=\' data-placeholder=\'知乎\'><label for=\'type-shequ\'><span style=\'color:#003daa\'>知乎</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-wechat\' value=\'https://weixin.sogou.com/weixin?type=2&amp;query=\' data-placeholder=\'微信\'><label for=\'type-wechat\'><span style=\'color:#003daa\'>微信</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-weiboo\' value=\'https://s.weibo.com/weibo/\' data-placeholder=\'微博\'><label for=\'type-weiboo\'><span style=\'color:#003daa\'>微博</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-doubann\' value=\'https://www.douban.com/search?q=\' data-placeholder=\'豆瓣\'><label for=\'type-doubann\'><span style=\'color:#003daa\'>豆瓣</span></label></li>");
document.writeln("<li><input hidden=\"\" type=\"radio\" name=\"type\" id=\"type-iData\" value=\"https://baike.baidu.com/item/\" data-placeholder=\"百度百科\"><label for=\"type-iData\"><span style=\'color:#003daa\'>百度百科</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-xiachufang\' value=\'https://www.mbalib.com/s?q=\' data-placeholder=\'MBA智库\'><label for=\'type-xiachufang\'><span style=\'color:#003daa\'>MBA智库</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");

document.writeln("<div class=\'search-group group-h\'>");
document.writeln("<span class=\'type-text\'>素材</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-sucai\' value=\'https://www.freepik.com/search?query=\' data-placeholder=\'Freepik\'><label for=\'type-sucai\'><span style=\'color:#003daa\'>Freepik</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-iconfinder\' value=\'https://www.iconfinder.com/search/?q=\' data-placeholder=\'IconFinder\'><label for=\'type-iconfinder\'><span style=\'color:#003daa\'>IconFinder</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-thenounproject\' value=\'https://thenounproject.com/search/?q=\' data-placeholder=\'Noun Project\'><label for=\'type-thenounproject\'><span style=\'color:#003daa\'>NounProject</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-zcool\' value=\'https://www.mockupworld.co/?s=\' data-placeholder=\'搜索Mockup\'><label for=\'type-zcool\'><span style=\'color:#003daa\'>MockupWorld</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-nipic\' value=\'https://mockupfree.co/?s=\' data-placeholder=\'搜索免费PSD\'><label for=\'type-nipic\'><span style=\'color:#003daa\'>Mockup</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-officeplus\' value=\'https://psddd.co/?s=\' data-placeholder=\'搜索PSD\'><label for=\'type-officeplus\'><span style=\'color:#003daa\'>PSDDD</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>	");

document.writeln("<div class=\'search-group group-y\'>");
document.writeln("<span class=\'type-text\'>生活</span>");
document.writeln("<ul class=\'search-type\'>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-shenghuo\' value=\'https://s.taobao.com/search?q=\' data-placeholder=\'淘宝\'><label for=\'type-shenghuo\'><span style=\'color:#003daa\'>淘宝</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-jd\' value=\'https://search.jd.com/Search?keyword=\' data-placeholder=\'京东\'><label for=\'type-jd\'><span style=\'color:#003daa\'>京东</span></label></li>");
document.writeln("<li><input checked hidden type=\'radio\'name=\'type\'id=\'type-kuaidi2\'value=\'https://m.kuaidi100.com/result.jsp?nu=\'data-placeholder=\'输入快递单号\'><label for=\'type-kuaidi2\'><span style=\'color:#003daa\'>快递</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-12306\' value=\'https://www.12306.cn/?\' data-placeholder=\'12306\'><label for=\'type-12306\'><span style=\'color:#003daa\'>12306</span></label></li>");
document.writeln("<li><input hidden=\'\' type=\'radio\' name=\'type\' id=\'type-qunar\' value=\'https://www.qunar.com/?\' data-placeholder=\'去哪儿\'><label for=\'type-qunar\'><span style=\'color:#003daa\'>去哪儿</span></label></li>");
document.writeln("</ul>");
document.writeln("</div>");
document.writeln("</div>");

document.writeln("<form  height=\"50px\"  action=\'https://www.baidu.com/s?wd=\'method=\'get\'target=\'_blank\'id=\'super-search-fm\'>");
document.writeln("<input type=\'text\'id=\'search-text\'placeholder=\'百度搜索\'style=\'outline:none\'autofocus/><button type=\'submit\'><i class=\'fa fa-search\'></i></button>");
document.writeln("</form>");
document.writeln("<div class=\'set-check hidden-xs\'>");
document.writeln("<input id=\'set-search-blank\'>");
document.writeln("</div>");
document.writeln("</div>");
document.writeln("<!-- END搜索栏 -->");

var __Ox1467e = [
    "checked",
    'input[name="type"][value="',
    '"]',
    "querySelector",
    "length",
    "s-current",
    "remove",
    "classList",
    "add",
    "parentNode",
    "superSearch",
    "setItem",
    "localStorage",
    "getItem",
    "target",
    "value",
    "type",
    "focus",
    "newWindow",
    "preventDefault",
    "",
    "action",
    "open",
    "href",
    'input[name="type"]:checked',
    "data-placeholder",
    "getAttribute",
    "placeholder",
    "setAttribute",
    "_blank",
    "removeAttribute",
    'input[name="type"]',
    "querySelectorAll",
    "#super-search-fm",
    "#search-text",
    "#set-search-blank",
    ".search-group",
    "change",
    "addEventListener",
    "submit"
  ];
!(function () {
  function _0x3bccx1() {
    _0x3bccx2(), _0x3bccx3(), _0x3bccx5(), _0x3bccx6();
  }
  function _0x3bccx2() {
    _0x3bccx17[__Ox1467e[0]] = _0x3bccxf();
  }
  function _0x3bccx3() {
    var _0x3bccx4 = document[__Ox1467e[3]](
      __Ox1467e[1] + _0x3bccxc() + __Ox1467e[2]
    );
    _0x3bccx4 && ((_0x3bccx4[__Ox1467e[0]] = !0), _0x3bccx7(_0x3bccx4));
  }
  function _0x3bccx5() {
    _0x3bccx12(_0x3bccx11());
  }
  function _0x3bccx6() {
    _0x3bccx13(_0x3bccx10());
  }
  function _0x3bccx7(_0x3bccx4) {
    for (var _0x3bccx8 = 0; _0x3bccx8 < _0x3bccx18[__Ox1467e[4]]; _0x3bccx8++) {
      _0x3bccx18[_0x3bccx8][__Ox1467e[7]][__Ox1467e[6]](__Ox1467e[5]);
    }
    _0x3bccx4[__Ox1467e[9]][__Ox1467e[9]][__Ox1467e[9]][__Ox1467e[7]][
      __Ox1467e[8]
    ](__Ox1467e[5]);
  }
  function _0x3bccx9(_0x3bccx4, _0x3bccx8) {
    window[__Ox1467e[12]][__Ox1467e[11]](__Ox1467e[10] + _0x3bccx4, _0x3bccx8);
  }
  function _0x3bccxa(_0x3bccx4) {
    return window[__Ox1467e[12]][__Ox1467e[13]](__Ox1467e[10] + _0x3bccx4);
  }
  function _0x3bccxb(_0x3bccx4) {
    (_0x3bccx19 = _0x3bccx4[__Ox1467e[14]]),
      _0x3bccx12(_0x3bccx11()),
      _0x3bccx13(_0x3bccx4[__Ox1467e[14]][__Ox1467e[15]]),
      _0x3bccx9(__Ox1467e[16], _0x3bccx4[__Ox1467e[14]][__Ox1467e[15]]),
      _0x3bccx16[__Ox1467e[17]](),
      _0x3bccx7(_0x3bccx4[__Ox1467e[14]]);
  }
  function _0x3bccxc() {
    var _0x3bccx8 = _0x3bccxa(__Ox1467e[16]);
    return _0x3bccx8 || _0x3bccx4[0][__Ox1467e[15]];
  }
  function _0x3bccxd(_0x3bccx4) {
    _0x3bccx9(__Ox1467e[18], _0x3bccx4[__Ox1467e[14]][__Ox1467e[0]] ? 1 : -1),
      _0x3bccx14(_0x3bccx4[__Ox1467e[14]][__Ox1467e[0]]);
  }
  function _0x3bccxe(_0x3bccx4) {
    return (
      _0x3bccx4[__Ox1467e[19]](),
      __Ox1467e[20] == _0x3bccx16[__Ox1467e[15]]
        ? (_0x3bccx16[__Ox1467e[17]](), !1)
        : (_0x3bccx13(_0x3bccx10() + _0x3bccx16[__Ox1467e[15]]),
          _0x3bccx14(_0x3bccxf()),
          _0x3bccxf()
            ? window[__Ox1467e[22]](_0x3bccx8[__Ox1467e[21]], +new Date())
            : (location[__Ox1467e[23]] = _0x3bccx8[__Ox1467e[21]]),
          void 0)
    );
  }
  function _0x3bccxf() {
    var _0x3bccx4 = _0x3bccxa(__Ox1467e[18]);
    return _0x3bccx4 ? 1 == _0x3bccx4 : !0;
  }
  function _0x3bccx10() {
    return document[__Ox1467e[3]](__Ox1467e[24])[__Ox1467e[15]];
  }
  function _0x3bccx11() {
    return document[__Ox1467e[3]](__Ox1467e[24])[__Ox1467e[26]](__Ox1467e[25]);
  }
  function _0x3bccx12(_0x3bccx4) {
    _0x3bccx16[__Ox1467e[28]](__Ox1467e[27], _0x3bccx4);
  }
  function _0x3bccx13(_0x3bccx4) {
    _0x3bccx8[__Ox1467e[21]] = _0x3bccx4;
  }
  function _0x3bccx14(_0x3bccx4) {
    _0x3bccx4
      ? (_0x3bccx8[__Ox1467e[14]] = __Ox1467e[29])
      : _0x3bccx8[__Ox1467e[30]](__Ox1467e[14]);
  }
  var _0x3bccx15,
    _0x3bccx4 = document[__Ox1467e[32]](__Ox1467e[31]),
    _0x3bccx8 = document[__Ox1467e[3]](__Ox1467e[33]),
    _0x3bccx16 = document[__Ox1467e[3]](__Ox1467e[34]),
    _0x3bccx17 = document[__Ox1467e[3]](__Ox1467e[35]),
    _0x3bccx18 = document[__Ox1467e[32]](__Ox1467e[36]),
    _0x3bccx19 = _0x3bccx4[0];
  for (
    _0x3bccx1(), _0x3bccx15 = 0;
    _0x3bccx15 < _0x3bccx4[__Ox1467e[4]];
    _0x3bccx15++
  ) {
    _0x3bccx4[_0x3bccx15][__Ox1467e[38]](__Ox1467e[37], _0x3bccxb);
  }
  _0x3bccx17[__Ox1467e[38]](__Ox1467e[37], _0x3bccxd),
    _0x3bccx8[__Ox1467e[38]](__Ox1467e[39], _0x3bccxe);
})();
