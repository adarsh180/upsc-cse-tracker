package com.adarsh.upsc;

import android.Manifest;
import android.app.*;
import android.content.*;
import android.content.pm.PackageManager;
import android.os.Build;

public class TimerReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        long end = context.getSharedPreferences("focus", Context.MODE_PRIVATE).getLong("end", 0);
        if (end == 0 || System.currentTimeMillis() < end) return;
        if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) return;
        NotificationManager manager = context.getSystemService(NotificationManager.class);
        manager.createNotificationChannel(new NotificationChannel("focus", "Focus timer", NotificationManager.IMPORTANCE_DEFAULT));
        PendingIntent open = PendingIntent.getActivity(context, 1, new Intent(context, MainActivity.class),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        manager.notify(1, new Notification.Builder(context, "focus")
            .setSmallIcon(android.R.drawable.ic_lock_idle_alarm).setContentTitle("Focus timer finished")
            .setContentText("Record what you completed in your Goals.")
            .setContentIntent(open).setAutoCancel(true).build());
    }
}
