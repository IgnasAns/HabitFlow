import { registerRootComponent } from 'expo';
import { registerWidgetTaskHandler, registerWidgetConfigurationScreen } from 'react-native-android-widget';

import App from './App';
import widgetTaskHandler from './src/widgets/widgetTaskHandler';
import WidgetConfigurationScreen from './src/widgets/WidgetConfigurationScreen';

// Register widget task handler for Android home screen widgets
registerWidgetTaskHandler(widgetTaskHandler);

// Register widget configuration screen for selecting habits
registerWidgetConfigurationScreen(WidgetConfigurationScreen);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
