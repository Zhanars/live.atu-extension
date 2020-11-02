
const startTranslationButton = document.getElementById('startTranslation');
startTranslationButton.onclick = startTranslation();

var connection = new RTCMultiConnection();

function captureCamera(callback) {
    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function(camera) {
        callback(camera);
    }).catch(function(error) {
        console.error(error);
    });
}
function stopRecordingCallback() {
    recorder.camera.stop();
    recorder = null;
    connection.attachStreams.forEach(function(stream) {
        stream.stop();
    });
    connection.closeSocket();
}
var recorder = []; // globally accessible
var blobs = [];
var countBlob = 0;
function startTranslation() {
    connection.attachStreams.forEach(function(stream) {
        stream.stop();
    });
    connection.closeSocket();
    connection.socketURL = 'https://socket.atu.kz:9001/';

    connection.dontGetRemoteStream = true;
    connection.autoCloseEntireSession = true;
    connection.session = {
        video: true,
        audio: false,
        oneway: true
    };
    connection.sdpConstraints.mandatory = {
        OfferToReceiveAudio: true,
        OfferToReceiveVideo: true
    };
    connection.extra = {
        fullName: '<?=$_SESSION["fio"]?>'
    };
    connection.processSdp = function(sdp) {
        if (DetectRTC.browser.name === 'Safari') {
            return sdp;
        }

        if (connection.codecs.video.toUpperCase() === 'VP8') {
            sdp = CodecsHandler.preferCodec(sdp, 'vp8');
        }

        if (connection.codecs.video.toUpperCase() === 'VP9') {
            sdp = CodecsHandler.preferCodec(sdp, 'vp9');
        }

        if (connection.codecs.video.toUpperCase() === 'H264') {
            sdp = CodecsHandler.preferCodec(sdp, 'h264');
        }

        if (connection.codecs.audio === 'G722') {
            sdp = CodecsHandler.removeNonG722(sdp);
        }

        if (DetectRTC.browser.name === 'Firefox') {
            return sdp;
        }

        if (connection.bandwidth.video || connection.bandwidth.screen) {
            sdp = CodecsHandler.setApplicationSpecificBandwidth(sdp, connection.bandwidth, !!connection.session.screen);
        }

        if (connection.bandwidth.video) {
            sdp = CodecsHandler.setVideoBitrates(sdp, {
                min: connection.bandwidth.video * 8 * 1024,
                max: connection.bandwidth.video * 8 * 1024
            });
        }

        if (connection.bandwidth.audio) {
            sdp = CodecsHandler.setOpusAttributes(sdp, {
                maxaveragebitrate: connection.bandwidth.audio * 8 * 1024,
                maxplaybackrate: connection.bandwidth.audio * 8 * 1024,
                stereo: 1,
                maxptime: 3
            });
        }

        return sdp;
    };
    connection.processSdp = function (sdp) {
        sdp = forceIsac(sdp);
        return sdp;
    };
    connection.processSdp = function(sdp) {
        // Disable NACK to test IDR recovery
        sdp = CodecsHandler.disableNACK(sdp);
        return sdp;
    };
    openCanal('uit-<?=$_SESSION["faculty_id"]?>-', 1);
    connection.isUpperUserLeft = false;

    captureCamera(function(camera) {
        recorder = RecordRTC(camera, {
            type: 'video',
            mimeType: 'video/webm',
            timeSlice: 5000,
            ondataavailable: function(blob) {
                blobs.push(blob);
                var size = 0;
                blobs.forEach(function(b) {
                    size += b.size;
                });
                countBlob++;
                var fileName = countBlob + '.webm';
                var fileObject = new File([blob], fileName, {
                    type: 'video/webm'
                });
                var formData = new FormData();
                formData.append('video-blob', fileObject);
                formData.append('students_id', students_id);
                formData.append('video-filename', fileObject.name);
                var upload_url = 'https://live.atu.kz/upload-video.php';
                $.ajax({
                    url: upload_url,
                    data: formData,
                    cache: false,
                    contentType: false,
                    processData: false,
                    type: 'POST',
                    success: function(response) {
                        if (response === 'success') {
                            console.log('successfully uploaded recorded blob');

                        } else {
                            console.log(response);
                        }
                    }
                });
            }
        });

        recorder.startRecording();

        // release camera on stopRecording
        recorder.camera = camera;
        countBlob = 0;
    });
}
function openCanal(id, i){
    connection.open(id + i, function(isRoomOpened, roomid, error) {
        if(error) {
            i++;
            openCanal(id, i);
        }
        if(isRoomOpened === true) {
            console.log('Создано комната = ' + roomid);
            connection.extra.roomint = roomid;
        }
    });
}
function forceIsac(sdp) {
    // Remove all other codecs (not the video codecs though).
    sdp = sdp.replace(/m=audio (\d+) RTP\/SAVPF.*\r\n/g,
        'm=audio $1 RTP/SAVPF 104\r\n');
    sdp = sdp.replace('a=fmtp:111 minptime=10', 'a=fmtp:104 minptime=10');
    sdp = sdp.replace(/a=rtpmap:(?!104)\d{1,3} (?!VP8|red|ulpfec).*\r\n/g, '');
    return sdp;
}
function stopTranslation(subject_id, ind, index) {

    $("#univer_link").hide();
    document.getElementById('stop' + subject_id + "-" + ind + "-" + index).disabled = true;
    recorder[subject_id][ind][index].stopRecording(stopRecordingCallback(subject_id, ind, index));
};