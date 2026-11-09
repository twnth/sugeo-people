import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

const configuredWebUrl = String.fromEnvironment('WEB_URL');
final Uri home = Uri.parse(
  configuredWebUrl.isEmpty ? 'http://localhost:3000' : configuredWebUrl,
);
const locationChannel = MethodChannel('clothmap/location');

bool sameOrigin(Uri uri) =>
    uri.scheme == home.scheme && uri.host == home.host && uri.port == home.port;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(const ClothMapApp());
}

class ClothMapApp extends StatelessWidget {
  const ClothMapApp({super.key});

  @override
  Widget build(BuildContext context) => MaterialApp(
    title: '옷함지도',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      colorScheme: ColorScheme.fromSeed(seedColor: const Color(0xFF24785C)),
      useMaterial3: true,
    ),
    home: const ClothMapWebView(),
  );
}

class ClothMapWebView extends StatefulWidget {
  const ClothMapWebView({super.key});

  @override
  State<ClothMapWebView> createState() => _ClothMapWebViewState();
}

class _ClothMapWebViewState extends State<ClothMapWebView> {
  late final WebViewController controller;
  final ImagePicker imagePicker = ImagePicker();
  int progress = 0;
  String? errorMessage;

  @override
  void initState() {
    super.initState();
    controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFFF7FAF8))
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: onNavigationRequest,
          onPageStarted: (_) => setState(() {
            errorMessage = null;
            progress = 0;
          }),
          onProgress: (value) => setState(() => progress = value),
          onPageFinished: (_) => setState(() => progress = 100),
          onWebResourceError: (error) {
            if (error.isForMainFrame == true) {
              setState(() => errorMessage = '웹 서비스를 불러올 수 없습니다.');
            }
          },
        ),
      );
    unawaited(start());
  }

  Future<void> start() async {
    if (Platform.isAndroid && controller.platform is AndroidWebViewController) {
      final android = controller.platform as AndroidWebViewController;
      await android.setGeolocationPermissionsPromptCallbacks(
        onShowPrompt: (request) async {
          final origin = Uri.tryParse(request.origin);
          if (origin == null || !sameOrigin(origin)) {
            return const GeolocationPermissionsResponse(
              allow: false,
              retain: false,
            );
          }
          final permitted =
              await locationChannel.invokeMethod<bool>(
                'requestLocationPermission',
              ) ??
              false;
          return GeolocationPermissionsResponse(
            allow: permitted,
            retain: false,
          );
        },
      );
      await android.setOnShowFileSelector((params) async {
        final current = await controller.currentUrl();
        final origin = current == null ? null : Uri.tryParse(current);
        if (origin == null || !sameOrigin(origin)) return <String>[];
        try {
          final selected = await imagePicker.pickImage(
            source: params.isCaptureEnabled
                ? ImageSource.camera
                : ImageSource.gallery,
            maxWidth: 1600,
            maxHeight: 1600,
            imageQuality: 80,
            requestFullMetadata: false,
          );
          return selected == null
              ? <String>[]
              : <String>[Uri.file(selected.path).toString()];
        } catch (_) {
          return <String>[];
        }
      });
    }
    await controller.loadRequest(home);
  }

  NavigationDecision onNavigationRequest(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);
    if (uri == null) return NavigationDecision.prevent;
    if (sameOrigin(uri) || uri.scheme == 'about') {
      return NavigationDecision.navigate;
    }
    if (uri.scheme == 'https' ||
        uri.scheme == 'http' ||
        uri.scheme == 'nmap' ||
        uri.scheme == 'intent') {
      unawaited(openExternal(uri));
    }
    return NavigationDecision.prevent;
  }

  Future<void> openExternal(Uri uri) async {
    bool opened;
    try {
      opened = await launchUrl(uri, mode: LaunchMode.externalApplication);
    } catch (_) {
      opened = false;
    }
    if (!opened && mounted) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('외부 앱을 열 수 없습니다.')));
    }
  }

  Future<void> goBack() async {
    if (await controller.canGoBack()) await controller.goBack();
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: false,
    onPopInvokedWithResult: (didPop, _) {
      if (!didPop) unawaited(goBack());
    },
    child: Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            WebViewWidget(controller: controller),
            if (progress < 100 && errorMessage == null)
              LinearProgressIndicator(value: progress / 100),
            if (errorMessage != null)
              Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.wifi_off, size: 40),
                      const SizedBox(height: 16),
                      Text(errorMessage!, textAlign: TextAlign.center),
                      const SizedBox(height: 8),
                      Text('연결 주소: $home', textAlign: TextAlign.center),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () => controller.loadRequest(home),
                        child: const Text('다시 시도'),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}
