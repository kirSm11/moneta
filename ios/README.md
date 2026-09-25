# Moneta for iOS

Нативная iOS-оболочка для веб-приложения из корня репозитория.

## Что внутри

- SwiftUI + WKWebView.
- HTML/CSS/JS и assets копируются в bundle при каждой сборке.
- Веб-файлы при первом запуске версии копируются в Application Support и загружаются оттуда, чтобы путь приложения оставался стабильным между обновлениями.
- IndexedDB/localStorage используют постоянное WKWebView-хранилище.
- Face ID работает через нативный LocalAuthentication.
- Экспорт JSON открывает системное iOS-меню «Поделиться».

## Как поставить на свой iPhone

1. Открой `ios/Moneta.xcodeproj` в Xcode.
2. Выбери target **Moneta** → **Signing & Capabilities**.
3. Выбери свой Apple ID / Team. Если Xcode попросит, поменяй Bundle Identifier на уникальный.
4. Подключи iPhone по кабелю или включи Wireless Debugging.
5. Выбери свой iPhone в списке устройств и нажми **Run**.

Для личной установки платная подписка Apple Developer не обязательна, но бесплатная подпись имеет ограничения по сроку действия.

## Сборка без Mac

Workflow `Build iOS IPA` собирает неподписанный `Moneta-unsigned.ipa` на GitHub-hosted macOS runner. Такой IPA можно затем подписать своим Apple Account и установить с Windows через совместимый sideload-инструмент.
