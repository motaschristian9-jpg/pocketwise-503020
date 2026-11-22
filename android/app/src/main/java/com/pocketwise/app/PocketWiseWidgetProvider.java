package com.pocketwise.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class PocketWiseWidgetProvider extends AppWidgetProvider {
    @Override public void onUpdate(Context context,AppWidgetManager manager,int[] ids){
        for(int id:ids){
            RemoteViews views=new RemoteViews(context.getPackageName(),R.layout.pocketwise_widget);
            Intent intent=new Intent(context,MainActivity.class);
            intent.setAction("com.pocketwise.app.OPEN_VOICE");
            intent.putExtra("pocketwise_voice_widget",true);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent pending=PendingIntent.getActivity(context,id,intent,PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.voice_widget_button,pending);
            manager.updateAppWidget(id,views);
        }
    }
}
