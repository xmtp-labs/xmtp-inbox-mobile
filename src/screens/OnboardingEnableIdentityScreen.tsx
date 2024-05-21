import {useDisconnect, useSigner} from '@thirdweb-dev/react-native';
import {Client} from '@xmtp/react-native-sdk';
import {StatusBar, VStack} from 'native-base';
import {useCallback, useEffect, useState} from 'react';
import {Alert, DeviceEventEmitter, Image, Platform} from 'react-native';
import {Button} from '../components/common/Button';
import {Icon} from '../components/common/Icon';
import {Screen} from '../components/common/Screen';
import {Text} from '../components/common/Text';
import {AppConfig} from '../consts/AppConfig';
import {supportedContentTypes} from '../consts/ContentTypes';
import {EventEmitterEvents} from '../consts/EventEmitters';
import {useClientContext} from '../context/ClientContext';
import {useTypedNavigation} from '../hooks/useTypedNavigation';
import {translate} from '../i18n';
import {ScreenNames} from '../navigation/ScreenNames';
import {saveClientKeys} from '../services/encryptedStorage';
import {PushNotificatons} from '../services/pushNotifications';
import {colors} from '../theme/colors';

type Step = 'CREATE_IDENTITY' | 'ENABLE_IDENTITY';

const createIdentityPromise = async () =>
  await new Promise<void>(resolve => {
    const sub = DeviceEventEmitter.addListener(
      EventEmitterEvents.CREATE_IDENTITY,
      () => {
        sub?.remove();
        resolve();
      },
    );
  });

const enableIdentityPromise = async () =>
  await new Promise<void>(resolve => {
    const sub = DeviceEventEmitter.addListener(
      EventEmitterEvents.ENABLE_IDENTITY,
      () => {
        sub?.remove();
        resolve();
      },
    );
  });

export const OnboardingEnableIdentityScreen = () => {
  const [step, setStep] = useState<Step>('CREATE_IDENTITY');
  const {navigate} = useTypedNavigation();
  const disconnect = useDisconnect();
  const signer = useSigner();
  const {setClient} = useClientContext();

  useEffect(() => {
    const startClientCreation = async () => {
      if (!signer) {
        return;
      }
      try {
        // const keyBytes = new Uint8Array([
        //   233, 120, 198, 96, 154, 65, 132, 17, 132, 96, 250, 40, 103, 35, 125,
        //   64, 166, 83, 208, 224, 254, 44, 205, 227, 175, 49, 234, 129, 74, 252,
        //   135, 145,
        // ]);
        const client = await Client.create(signer, {
          enableAlphaMls: true,
          env: AppConfig.XMTP_ENV,
          preEnableIdentityCallback: async () => {
            setStep('ENABLE_IDENTITY');
            await enableIdentityPromise();
          },
          preCreateIdentityCallback: async () => {
            await createIdentityPromise();
          },
          codecs: supportedContentTypes,
          // dbEncryptionKey: keyBytes,
        });
        if (Platform.OS !== 'android') {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const _ = new PushNotificatons(client);
        }
        const keys = await client.exportKeyBundle();
        const address = client.address;
        saveClientKeys(address as `0x${string}`, keys);
        setClient(client);
      } catch (e: any) {
        console.log('Error creating client', e);
        Alert.alert('Error creating client', e?.message);
      }
    };
    startClientCreation();
  }, [setClient, signer]);

  const handleCreateIdentity = useCallback(() => {
    DeviceEventEmitter.emit(EventEmitterEvents.CREATE_IDENTITY);
  }, []);

  const handleEnableIdentity = useCallback(() => {
    DeviceEventEmitter.emit(EventEmitterEvents.ENABLE_IDENTITY);
  }, []);

  const handleDisconnectWallet = useCallback(async () => {
    await disconnect();
    navigate(ScreenNames.OnboardingConnectWallet);
  }, [navigate, disconnect]);

  return (
    <Screen includeTopPadding={false}>
      <StatusBar animated={true} backgroundColor="#00000000" hidden={true} />
      <Image
        source={require('../../assets/images/xmtp-logo-empty.png')}
        style={{justifyContent: 'center', alignItems: 'center', width: '100%'}}
      />
      <VStack
        position={'absolute'}
        bottom={'1/6'}
        backgroundColor={'warmGray.100'}
        width={'100%'}
        alignItems={'center'}
        background={colors.backgroundPrimary}
        flex={1}
        justifyContent={'space-evenly'}
        paddingX={'24px'}>
        {step === 'CREATE_IDENTITY' ? (
          <>
            <Text textAlign={'center'} typography="text-title/regular">
              {translate('step_1_of_2')}
            </Text>
            <Text textAlign={'center'} typography="text-4xl/bold">
              {translate('create_your_xmtp_identity')}
            </Text>
            <Text marginTop={2} textAlign={'center'}>
              {translate('now_that_your_wallet_is_connected')}
            </Text>
            <Button
              marginTop={6}
              paddingX={6}
              variant={'solid'}
              backgroundColor={'brand.800'}
              rightIcon={
                <Icon
                  name="arrow-right-circle-thick"
                  size={24}
                  color={colors.actionPrimaryText}
                />
              }
              onPress={handleCreateIdentity}>
              <Text
                paddingLeft={6}
                paddingY={2}
                typography="text-lg/heavy"
                color={colors.backgroundPrimary}>
                {translate('create_your_xmtp_identity')}
              </Text>
            </Button>
            <Button
              marginTop={4}
              variant={'ghost'}
              onPress={handleDisconnectWallet}>
              <Text typography="text-sm/bold" color={colors.actionNegative}>
                {translate('disconnect_wallet')}
              </Text>
            </Button>
          </>
        ) : (
          <>
            <Text typography="text-title/regular">Step 2 of 2</Text>
            <Text typography="text-4xl/bold">
              {translate('your_interoperable_web3_inbox')}
            </Text>
            <Text>
              {translate(
                'youre_just_a_few_steps_away_from_secure_wallet_to_wallet_messaging',
              )}
            </Text>
            <Button
              marginTop={6}
              variant={'solid'}
              backgroundColor={'brand.800'}
              rightIcon={
                <Icon
                  name="arrow-right-circle-thick"
                  size={24}
                  color={colors.actionPrimaryText}
                />
              }
              onPress={handleEnableIdentity}>
              <Text
                paddingY={2}
                paddingX={6}
                typography="text-lg/heavy"
                color={colors.backgroundPrimary}>
                {translate('connect_your_wallet')}
              </Text>
            </Button>
            <Button
              marginTop={4}
              variant={'ghost'}
              onPress={handleDisconnectWallet}>
              <Text typography="text-sm/bold" color={colors.actionNegative}>
                {translate('disconnect_wallet')}
              </Text>
            </Button>
          </>
        )}
      </VStack>
    </Screen>
  );
};
