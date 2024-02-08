import {useRoute} from '@react-navigation/native';
import {DecodedMessage, RemoteAttachmentContent} from '@xmtp/react-native-sdk';
import {
  Box,
  FlatList,
  HStack,
  KeyboardAvoidingView,
  Pressable,
  VStack,
} from 'native-base';
import React, {useCallback, useEffect, useState} from 'react';
import {ListRenderItem, Platform} from 'react-native';
import {Asset} from 'react-native-image-picker';
import {AvatarWithFallback} from '../components/AvatarWithFallback';
import {ConversationInput} from '../components/ConversationInput';
import {ConversationMessageContent} from '../components/ConversationMessageContent';
import {GroupHeader} from '../components/GroupHeader';
import {Button} from '../components/common/Button';
import {Drawer} from '../components/common/Drawer';
import {Icon} from '../components/common/Icon';
import {Modal} from '../components/common/Modal';
import {Screen} from '../components/common/Screen';
import {Text} from '../components/common/Text';
import {useClient} from '../hooks/useClient';
import {useContactInfo} from '../hooks/useContactInfo';
import {useGroup} from '../hooks/useGroup';
import {useGroupMessages} from '../hooks/useGroupMessages';
import {translate} from '../i18n';
import {getConsent, saveConsent} from '../services/mmkvStorage';
import {AWSHelper} from '../services/s3';
import {colors} from '../theme/colors';

const GroupParticipant: React.FC<{address: string}> = ({address}) => {
  const {displayName, avatarUrl} = useContactInfo(address);
  return (
    <VStack alignItems={'center'} justifyContent={'center'}>
      <HStack>
        <Text typography="text-xl/bold" textAlign={'center'}>
          {displayName}
        </Text>
        <AvatarWithFallback size={40} address={address} avatarUri={avatarUrl} />
      </HStack>
      <Text typography="text-sm/bold">{translate('domain_origin')}</Text>

      <Button
        variant={'ghost'}
        rightIcon={
          <Icon
            name={'arrow-right'}
            type={'mini'}
            color={colors.actionPrimary}
          />
        }>
        <Text
          typography="text-base/bold"
          color={colors.actionPrimary}
          textAlign={'center'}>
          {'lenster.xyz'}
        </Text>
      </Button>
    </VStack>
  );
};

const getTimestamp = (timestamp: number) => {
  // If today, return hours and minutes if not return date
  const date = new Date(timestamp);
  const now = new Date();
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return `${date.getHours()}:${date.getMinutes()}`;
  }
  return date.toLocaleDateString();
};

const useData = (id: string) => {
  const {messages, refetch} = useGroupMessages(id);
  const {client} = useClient();
  const {group} = useGroup(id);
  // const cachedPeerAddress = getTopicAddresses(id)?.[0];
  // const {displayName, avatarUrl} = useContactInfo(
  //   conversation?.peerAddress || '',
  // );

  // useEffect(() => {
  //   if (id && conversation?.peerAddress) {
  //     saveTopicAddresses(id, [conversation?.peerAddress]);
  //   }
  // }, [conversation?.peerAddress, id]);

  return {
    // profileImage: avatarUrl,
    name: group?.id,
    addresses: group?.peerAddresses,
    myAddress: client?.address,
    messages,
    group,
    client,
    refetch,
  };
};

const getInitialConsentState = (addresses: string, peerAddress: string) => {
  const cachedConsent = getConsent(addresses, peerAddress);
  if (cachedConsent === undefined) {
    return 'unknown';
  }
  if (cachedConsent) {
    return 'allowed';
  }
  return 'denied';
};

export const GroupScreen = () => {
  const {params} = useRoute();
  const {id} = params as {id: string};
  const {myAddress, messages, addresses, group, client, refetch} = useData(id);
  const [showReply, setShowReply] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [consent, setConsent] = useState<'allowed' | 'denied' | 'unknown'>(
    getInitialConsentState(myAddress ?? '', group?.id ?? ''),
  );

  useEffect(() => {
    if (!group) {
      return;
    }
    // TODO: Update with consent
    setConsent('allowed');
    // group..then(currentConsent => {
    //   setConsent(currentConsent);
    // });
  }, [group]);

  const sendMessage = useCallback(
    async (payload: {text?: string; asset?: Asset}) => {
      if (!group) {
        return;
      }
      if (payload.text) {
        group?.send(payload.text).then(refetch);
      }
      if (payload.asset) {
        client
          ?.encryptAttachment({
            fileUri: payload.asset.uri ?? '',
            mimeType: payload.asset.type,
          })
          .then(encrypted => {
            AWSHelper.uploadFile(
              encrypted.encryptedLocalFileUri,
              encrypted.metadata.filename ?? '',
            ).then(response => {
              const remote: RemoteAttachmentContent = {
                ...encrypted.metadata,
                scheme: 'https://',
                url: response,
              };
              group
                ?.send({remoteAttachment: remote})
                .then(refetch)
                .catch(() => {});
            });
          })
          .catch(() => {});
      }
    },
    [client, group, refetch],
  );

  const renderItem: ListRenderItem<DecodedMessage<unknown>> = ({item}) => {
    const isMe =
      item.senderAddress?.toLocaleLowerCase() ===
      myAddress?.toLocaleLowerCase();
    return (
      <Pressable>
        <Box marginLeft={6} marginRight={6} marginY={2} flexShrink={1}>
          <VStack>
            <ConversationMessageContent message={item} isMe={isMe} />
            <Text
              flexShrink={1}
              color={colors.primaryN200}
              typography="text-xs/semi-bold"
              alignSelf={isMe ? 'flex-end' : 'flex-start'}>
              {getTimestamp(item.sent)}
            </Text>
          </VStack>
        </Box>
      </Pressable>
    );
  };

  const onConsent = useCallback(() => {
    if (addresses) {
      client?.contacts.allow(addresses);
    }
    setConsent('allowed');
    saveConsent(myAddress ?? '', id ?? '', true);
  }, [addresses, client?.contacts, myAddress, id]);

  const onBlock = useCallback(() => {
    if (addresses) {
      client?.contacts.deny(addresses);
    }
    setConsent('denied');
    saveConsent(myAddress ?? '', id ?? '', false);
  }, [addresses, client?.contacts, id, myAddress]);

  return (
    <>
      <Screen
        includeTopPadding={false}
        containerStlye={{
          alignItems: undefined,
        }}>
        <Box backgroundColor={colors.backgroundPrimary} paddingBottom={10}>
          <GroupHeader
            peerAddresses={addresses ?? []}
            onGroupPress={() => setShowGroupModal(false)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            height={'100%'}
            paddingBottom={'10px'}
            w="100%">
            <Box flex={1}>
              <FlatList
                keyExtractor={item => item.id}
                inverted
                data={messages}
                renderItem={renderItem}
                ListFooterComponent={<Box height={'100px'} />}
              />
            </Box>
            {consent !== 'unknown' ? (
              <ConversationInput
                sendMessage={sendMessage}
                currentAddress={myAddress}
                id={id}
              />
            ) : (
              <HStack justifyContent={'space-around'} marginX={'40px'}>
                <Button onPress={onConsent}>
                  <Text
                    typography="text-base/medium"
                    color={colors.backgroundPrimary}>
                    {translate('allow')}
                  </Text>
                </Button>
                <Button onPress={onBlock}>
                  <Text
                    typography="text-base/medium"
                    color={colors.backgroundPrimary}>
                    {translate('block')}
                  </Text>
                </Button>
              </HStack>
            )}
          </KeyboardAvoidingView>
        </Box>
      </Screen>

      <Drawer
        title="Test"
        isOpen={showReply}
        onBackgroundPress={() => setShowReply(false)}>
        <VStack w={'100%'} alignItems={'flex-start'}>
          <Box
            backgroundColor={'white'}
            paddingX={'4px'}
            paddingY={'6px'}
            marginRight={'12px'}>
            <Text>Test</Text>
          </Box>
        </VStack>
      </Drawer>
      <Modal
        onBackgroundPress={() => setShowGroupModal(false)}
        isOpen={showGroupModal}>
        <VStack alignItems={'center'} justifyContent={'center'}>
          {addresses?.map(address => (
            <GroupParticipant key={address} address={address} />
          ))}
        </VStack>
      </Modal>
    </>
  );
};
