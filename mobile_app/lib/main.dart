import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'providers/inventory_provider.dart';
import 'screens/upload_screen.dart';
import 'screens/main_dashboard_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => InventoryProvider()),
      ],
      child: const NetInventoryApp(),
    ),
  );
}

class NetInventoryApp extends StatelessWidget {
  const NetInventoryApp({super.key});

  @override
  Widget build(BuildContext context) {
    final hasData = context.watch<InventoryProvider>().hasData;

    return MaterialApp(
      title: 'Pengvisualisasi Data Mobile',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFFF8FAFC),
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF2563EB),
          primary: const Color(0xFF2563EB),
          secondary: const Color(0xFF0EA5E9),
          surface: Colors.white,
        ),
        textTheme: GoogleFonts.interTextTheme(Theme.of(context).textTheme),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          elevation: 0,
          scrolledUnderElevation: 0.5,
          iconTheme: IconThemeData(color: Color(0xFF0F172A)),
        ),
      ),
      home: hasData ? const MainDashboardScreen() : const UploadScreen(),
    );
  }
}
