import React, { createContext, useState, useCallback } from 'react';
import { CustomModal, CustomModalConfig, ModalType } from '../components/CustomModal';

interface ModalContextType {
  show: (config: Omit<CustomModalConfig, 'visible'>) => void;
  hide: () => void;
  showSuccess: (title: string, message: string, onDismiss?: () => void) => void;
  showError: (title: string, message: string, onDismiss?: () => void) => void;
  showWarning: (title: string, message: string, onDismiss?: () => void) => void;
  showInfo: (title: string, message: string, onDismiss?: () => void) => void;
  showConfirmation: (
    title: string,
    message: string,
    onConfirm: () => void,
    onCancel?: () => void
  ) => void;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<CustomModalConfig>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    buttons: [],
  });

  const hide = useCallback(() => {
    setConfig((prev: CustomModalConfig) => ({ ...prev, visible: false }));
  }, []);

  const show = useCallback((newConfig: Omit<CustomModalConfig, 'visible'>) => {
    setConfig({
      ...newConfig,
      visible: true,
    });
  }, []);

  const showSuccess = useCallback(
    (title: string, message: string, onDismiss?: () => void) => {
      show({
        type: 'success',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            onPress: onDismiss || hide,
          },
        ],
      });
    },
    [show, hide]
  );

  const showError = useCallback(
    (title: string, message: string, onDismiss?: () => void) => {
      show({
        type: 'error',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            onPress: onDismiss || hide,
          },
        ],
      });
    },
    [show, hide]
  );

  const showWarning = useCallback(
    (title: string, message: string, onDismiss?: () => void) => {
      show({
        type: 'warning',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            onPress: onDismiss || hide,
          },
        ],
      });
    },
    [show, hide]
  );

  const showInfo = useCallback(
    (title: string, message: string, onDismiss?: () => void) => {
      show({
        type: 'info',
        title,
        message,
        buttons: [
          {
            text: 'OK',
            onPress: onDismiss || hide,
          },
        ],
      });
    },
    [show, hide]
  );

  const showConfirmation = useCallback(
    (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
      show({
        type: 'confirmation',
        title,
        message,
        buttons: [
          {
            text: 'Cancel',
            onPress: onCancel || hide,
            style: 'cancel',
          },
          {
            text: 'Confirm',
            onPress: onConfirm,
          },
        ],
      });
    },
    [show, hide]
  );

  const value: ModalContextType = {
    show,
    hide,
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showConfirmation,
  };

  return (
    <ModalContext.Provider value={value}>
      {children}
      <CustomModal {...config} onDismiss={hide} />
    </ModalContext.Provider>
  );
};
