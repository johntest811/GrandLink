import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export type ModalType = 'success' | 'error' | 'warning' | 'info' | 'confirmation';

export interface CustomModalConfig {
  visible: boolean;
  type: ModalType;
  title: string;
  message: string;
  buttons?: {
    text: string;
    onPress: () => void;
    style?: 'default' | 'cancel' | 'destructive';
  }[];
}

const defaultConfig: CustomModalConfig = {
  visible: false,
  type: 'info',
  title: '',
  message: '',
  buttons: [],
};

export const CustomModal: React.FC<CustomModalConfig & { onDismiss?: () => void }> = ({
  visible,
  type,
  title,
  message,
  buttons,
  onDismiss,
}) => {
  const isSuccess = type === 'success';

  const getIconName = (): keyof typeof MaterialIcons.glyphMap => {
    switch (type) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'confirmation':
        return 'help';
      case 'info':
      default:
        return 'info';
    }
  };

  const getIconColor = (): string => {
    switch (type) {
      case 'success':
        return '#10b981';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'confirmation':
        return '#3b82f6';
      case 'info':
      default:
        return '#3b82f6';
    }
  };

  const getBackgroundColor = (): string => {
    switch (type) {
      case 'success':
        return '#e6efe9';
      case 'error':
        return '#fef2f2';
      case 'warning':
        return '#fffbeb';
      case 'confirmation':
        return '#eff6ff';
      case 'info':
      default:
        return '#eff6ff';
    }
  };

  // Default buttons if none provided
  const defaultButtons = buttons || [
    {
      text: 'OK',
      onPress: onDismiss || (() => {}),
    },
  ];

  const handleButtonPress = (onPress: () => void) => {
    onPress();
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={[styles.modalContainer, { backgroundColor: getBackgroundColor() }]}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            {isSuccess ? (
              <View style={styles.successIconCircle}>
                <Ionicons name="checkmark" size={34} color="#ffffff" />
              </View>
            ) : (
              <MaterialIcons
                name={getIconName()}
                size={56}
                color={getIconColor()}
              />
            )}
          </View>

          {/* Title */}
          {title && (
            <Text style={styles.title}>{title}</Text>
          )}

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={styles.buttonsContainer}>
            {defaultButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'destructive' && styles.buttonDestructive,
                  button.style === 'cancel' && styles.buttonCancel,
                  button.style !== 'destructive' && button.style !== 'cancel' && styles.buttonDefault,
                  defaultButtons.length > 1 && styles.buttonHalf,
                ]}
                onPress={() => handleButtonPress(button.onPress)}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'destructive' && styles.buttonTextDestructive,
                    button.style === 'cancel' && styles.buttonTextCancel,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    borderRadius: 18,
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 24,
    width: '88%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1fb576',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    color: '#1f2937',
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    color: '#505a64',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 7,
    minWidth: 80,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonHalf: {
    flex: 1,
  },
  buttonDefault: {
    backgroundColor: '#111111',
  },
  buttonDestructive: {
    backgroundColor: '#ef4444',
  },
  buttonCancel: {
    backgroundColor: '#e5e7eb',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
  buttonTextDestructive: {
    color: '#fff',
  },
  buttonTextCancel: {
    color: '#1f2937',
  },
});
