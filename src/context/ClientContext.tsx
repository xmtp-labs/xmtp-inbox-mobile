import {useAddress, useConnectionStatus} from '@thirdweb-dev/react-native';
import {Client, RemoteAttachmentCodec} from '@xmtp/react-native-sdk';
import React, {
  FC,
  PropsWithChildren,
  createContext,
  useEffect,
  useState,
} from 'react';
import {AppConfig} from '../consts/AppConfig';
import {clearClientKeys, getClientKeys} from '../services/encryptedStorage';

interface ClientContextValue {
  client: Client<unknown> | null;
  setClient: React.Dispatch<React.SetStateAction<Client<unknown> | null>>;
  loading: boolean;
}

export const ClientContext = createContext<ClientContextValue>({
  client: null,
  setClient: () => {
    throw new Error('setClient not implemented');
  },
  loading: true,
});

export const ClientProvider: FC<PropsWithChildren> = ({children}) => {
  const [client, setClient] = useState<Client<unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const address = useAddress();
  const status = useConnectionStatus();

  useEffect(() => {
    if (status === 'unknown' || status === 'connecting') {
      return;
    }
    if (status === 'disconnected') {
      return setLoading(false);
    }
    if (!address) {
      // Address still shows as undefined even when connected
      return;
    }
    getClientKeys(address as `0x${string}`)
      .then(keys => {
        if (!keys) {
          return setLoading(false);
        }
        Client.createFromKeyBundle(keys, {
          codecs: [new RemoteAttachmentCodec()],
          enableAlphaMls: AppConfig.GROUPS_ENABLED,
          env: AppConfig.XMTP_ENV,
        })
          .then(newClient => {
            setClient(newClient);
            setLoading(false);
          })
          .catch(() => {
            clearClientKeys(address as `0x${string}`);
            setLoading(false);
          });
      })
      .catch(() => {
        return setLoading(false);
      });
  }, [address, status]);

  return (
    <ClientContext.Provider
      value={{
        client,
        setClient,
        loading,
      }}>
      {children}
    </ClientContext.Provider>
  );
};

export const useClientContext = () => {
  return React.useContext(ClientContext);
};
