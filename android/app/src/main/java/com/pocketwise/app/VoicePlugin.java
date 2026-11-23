package com.pocketwise.app;

import android.Manifest;
import android.content.Intent;
import android.os.Build;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.os.Bundle;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PluginMethod;
import java.util.ArrayList;
import java.util.Locale;

@CapacitorPlugin(name="PocketVoice", permissions={@Permission(alias="microphone",strings={Manifest.permission.RECORD_AUDIO})})
public class VoicePlugin extends Plugin {
    private SpeechRecognizer recognizer;
    private PluginCall active;
    @PluginMethod public void consumeWidgetLaunch(PluginCall call) {
        Intent intent=getActivity().getIntent();
        boolean launched=intent!=null && intent.getBooleanExtra("pocketwise_voice_widget",false);
        if(launched)intent.removeExtra("pocketwise_voice_widget");
        JSObject result=new JSObject();result.put("launched",launched);call.resolve(result);
    }
    @PluginMethod public void listen(PluginCall call) {
        if(getPermissionState("microphone")!=com.getcapacitor.PermissionState.GRANTED){
            requestPermissionForAlias("microphone",call,"microphoneGranted");return;
        }
        start(call);
    }
    @PermissionCallback private void microphoneGranted(PluginCall call) {
        if(getPermissionState("microphone")==com.getcapacitor.PermissionState.GRANTED)start(call);
        else call.reject("Microphone permission denied");
    }
    private void start(PluginCall call){
        if(active!=null){call.reject("Voice recognition already running");return;}
        if(Build.VERSION.SDK_INT<31 || !SpeechRecognizer.isOnDeviceRecognitionAvailable(getContext())){
            call.reject("Offline speech recognition is unavailable on this device. Use typed commands.");return;
        }
        active=call;
        getActivity().runOnUiThread(()->{
            try{
                recognizer=SpeechRecognizer.createOnDeviceSpeechRecognizer(getContext());
                recognizer.setRecognitionListener(new RecognitionListener(){
                    @Override public void onReadyForSpeech(Bundle b){}
                    @Override public void onBeginningOfSpeech(){}
                    @Override public void onRmsChanged(float r){}
                    @Override public void onBufferReceived(byte[] b){}
                    @Override public void onEndOfSpeech(){}
                    @Override public void onPartialResults(Bundle b){}
                    @Override public void onEvent(int t,Bundle b){}
                    @Override public void onError(int code){finish(null,"Speech recognition error "+code+". Check your offline language pack.");}
                    @Override public void onResults(Bundle b){
                        ArrayList<String> words=b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                        finish(words!=null&&!words.isEmpty()?words.get(0):"",null);
                    }
                });
                Intent intent=new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL,RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE,"fil-PH");
                intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE,"ceb-PH");
                intent.putExtra("android.speech.extra.EXTRA_ADDITIONAL_LANGUAGES",new String[]{"ceb-PH","fil-PH","en-PH"});
                intent.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE,true);
                recognizer.startListening(intent);
            }catch(Exception e){finish(null,"Could not start offline speech recognition: "+e.getMessage());}
        });
    }
    private void finish(String text,String error){
        PluginCall call=active;active=null;
        if(recognizer!=null){recognizer.destroy();recognizer=null;}
        if(call==null)return;
        if(error!=null)call.reject(error);
        else{JSObject o=new JSObject();o.put("text",text);call.resolve(o);}
    }
    @Override protected void handleOnDestroy(){
        if(recognizer!=null){recognizer.destroy();recognizer=null;}
        if(active!=null){active.reject("Voice recognition interrupted");active=null;}
        super.handleOnDestroy();
    }
}
