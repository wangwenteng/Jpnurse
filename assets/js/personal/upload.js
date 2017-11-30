var filechooser = document.getElementById("choose");
//    用于压缩图片的canvas
var canvas = document.createElement("canvas");
var ctx = canvas.getContext('2d');
//    瓦片canvas
var tCanvas = document.createElement("canvas");
var tctx = tCanvas.getContext("2d");
var maxsize = 100 * 1024;
$("#upload").on("click", function() {
		filechooser.click();
	})
	.on("touchstart", function() {

		$(this).addClass("touch")
	})
	.on("touchend", function() {
		$(this).removeClass("touch")

	});
filechooser.onchange = function() {
	toastLoading1("正在上传中...");
	if(!this.files.length) return;
	var files = Array.prototype.slice.call(this.files);
	if(files.length > 1) {
		ClosetoastLoading1();
		layer.msg("只能选择一张图片", { time: 1000 });
		return;
		ClosetoastLoading1();
	}
	files.forEach(function(file, i) {
		if(!/\/(?:jpeg|png|gif)/i.test(file.type)) return;
		var reader = new FileReader();
		var size = file.size / 1024 > 1024 ? (~~(10 * file.size / 1024 / 1024)) / 10 + "MB" : ~~(file.size / 1024) + "KB";
		reader.onload = function() {
			var result = this.result;
			var img = new Image();
			img.src = result;
			if(result.length <= maxsize) {
				img = null;
				upload(result, file.type);
				return;
			}
			// 图片加载完毕之后进行压缩，然后上传
			if(img.complete) {
				callback();
			} else {
				img.onload = callback;
			}

			function callback() {
				var data = compress(img);
				upload(data, file.type);
				img = null;
			}
		};
		reader.readAsDataURL(file);

	})
};
//    使用canvas对大图片进行压缩
function compress(img) {
	var initSize = img.src.length;
	var width = img.width;
	var height = img.height;
	//如果图片大于四百万像素，计算压缩比并将大小压至400万以下
	var ratio;
	if((ratio = width * height / 4000000) > 1) {
		ratio = Math.sqrt(ratio);
		width /= ratio;
		height /= ratio;
	} else {
		ratio = 1;
	}
	canvas.width = width;
	canvas.height = height;
	//        铺底色
	ctx.fillStyle = "#fff";
	ctx.fillRect(0, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
	//如果图片像素大于100万则使用瓦片绘制
	var count;
	if((count = width * height / 1000000) > 1) {
		count = ~~(Math.sqrt(count) + 1); //计算要分成多少块瓦片
		//            计算每块瓦片的宽和高
		var nw = ~~(width / count);
		var nh = ~~(height / count);
		tCanvas.width = nw;
		tCanvas.height = nh;
		for(var i = 0; i < count; i++) {
			for(var j = 0; j < count; j++) {
				tctx.drawImage(img, i * nw * ratio, j * nh * ratio, nw * ratio, nh * ratio, 0, 0, nw, nh);
				ctx.drawImage(tCanvas, i * nw, j * nh, nw, nh);
			}
		}
	} else {
		ctx.drawImage(img, 0, 0, width, height, 0, 0, width, height);
	}
	//进行最小压缩
	var ndata = canvas.toDataURL('image/jpeg', 0.5);
	console.log('压缩前：' + initSize);
	console.log('压缩后：' + ndata.length);
	console.log('压缩率：' + ~~(100 * (initSize - ndata.length) / initSize) + "%");
	tCanvas.width = tCanvas.height = canvas.width = canvas.height = 0;
	return ndata;
}
//    图片上传，将base64的图片转成二进制对象，塞进formdata上传
function upload(basestr, type) {
	var text = window.atob(basestr.split(",")[1]);
	var buffer = new Uint8Array(text.length);
	var pecent = 0,
		loop = null;
	for(var i = 0; i < text.length; i++) {
		buffer[i] = text.charCodeAt(i);
	}
	var blob = getBlob([buffer], type);
	var xhr = new XMLHttpRequest();
	var formdata = getFormData();
	formdata.append('file', blob);
	var infoid = JSON.parse(localStorage.getItem("set"));
	xhr.open('post', img_tx + "&userId=" + infoid.id);
	xhr.onreadystatechange = function() {
		//console.log(xhr)
		if(xhr.readyState == 4 && xhr.status == 200) {
			var jsonData = JSON.parse(xhr.responseText);
			var text = jsonData.result ? '上传成功' : '上传失败';
			console.log(text + '：' + jsonData.result);
			$("#demo1").attr("src", jsonData.result);
			ClosetoastLoading1();
			clearInterval(loop);
		}
	};
	xhr.send(formdata);
}
/**
 * 获取blob对象的兼容性写法
 * @param buffer
 * @param format
 * @returns {*}
 */
function getBlob(buffer, format) {
	try {
		return new Blob(buffer, { type: format });
	} catch(e) {
		var bb = new(window.BlobBuilder || window.WebKitBlobBuilder || window.MSBlobBuilder);
		buffer.forEach(function(buf) {
			bb.append(buf);
		});
		return bb.getBlob(format);
	}
}
/**
 * 获取formdata
 */
function getFormData() {
	var isNeedShim = ~navigator.userAgent.indexOf('Android') &&
		~navigator.vendor.indexOf('Google') &&
		!~navigator.userAgent.indexOf('Chrome') &&
		navigator.userAgent.match(/AppleWebKit\/(\d+)/).pop() <= 534;
	return isNeedShim ? new FormDataShim() : new FormData()
}
/**
 * formdata 补丁, 给不支持formdata上传blob的android机打补丁
 * @constructor
 */
function FormDataShim() {
	console.warn('using formdata shim');
	var o = this,
		parts = [],
		boundary = Array(21).join('-') + (+new Date() * (1e16 * Math.random())).toString(36),
		oldSend = XMLHttpRequest.prototype.send;
	this.append = function(name, value, filename) {
		parts.push('--' + boundary + '\r\nContent-Disposition: form-data; name="' + name + '"');
		if(value instanceof Blob) {
			parts.push('; filename="' + (filename || 'blob') + '"\r\nContent-Type: ' + value.type + '\r\n\r\n');
			parts.push(value);
		} else {
			parts.push('\r\n\r\n' + value);
		}
		parts.push('\r\n');
	};
	// Override XHR send()
	XMLHttpRequest.prototype.send = function(val) {
		var fr,
			data,
			oXHR = this;
		if(val === o) {
			// Append the final boundary string
			parts.push('--' + boundary + '--\r\n');
			// Create the blob
			data = getBlob(parts);
			// Set up and read the blob into an array to be sent
			fr = new FileReader();
			fr.onload = function() {
				oldSend.call(oXHR, fr.result);
			};
			fr.onerror = function(err) {
				throw err;
			};
			fr.readAsArrayBuffer(data);
			// Set the multipart content type and boudary
			this.setRequestHeader('Content-Type', 'multipart/form-data; boundary=' + boundary);
			XMLHttpRequest.prototype.send = oldSend;
		} else {
			oldSend.call(this, val);
		}
	};
}