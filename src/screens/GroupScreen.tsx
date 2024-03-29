import {useFocusEffect, useRoute} from '@react-navigation/native';
import {RemoteAttachmentContent} from '@xmtp/react-native-sdk';
import {Box, FlatList, HStack, Pressable, VStack} from 'native-base';
import React, {useCallback, useEffect, useState} from 'react';
import {KeyboardAvoidingView, ListRenderItem, Platform} from 'react-native';
import {Asset} from 'react-native-image-picker';
import {ConversationInput} from '../components/ConversationInput';
import {ConversationMessageContent} from '../components/ConversationMessageContent';
import {GroupHeader} from '../components/GroupHeader';
import {Button} from '../components/common/Button';
import {Drawer} from '../components/common/Drawer';
import {Screen} from '../components/common/Screen';
import {Text} from '../components/common/Text';
import {AddGroupParticipantModal} from '../components/modals/AddGroupParticipantModal';
import {GroupInfoModal} from '../components/modals/GroupInfoModal';
import {ContentTypes} from '../consts/ContentTypes';
import {useClient} from '../hooks/useClient';
import {useGroup} from '../hooks/useGroup';
import {useGroupMessages} from '../hooks/useGroupMessages';
import {translate} from '../i18n';
import {useGroupParticipantsQuery} from '../queries/useGroupParticipantsQuery';
import {mmkvStorage} from '../services/mmkvStorage';
import {AWSHelper} from '../services/s3';
import {colors} from '../theme/colors';
import {formatAddress} from '../utils/formatAddress';

const keyExtractor = (item: string) => item;

const getTimestamp = (timestamp: number) => {
  // If today, return hours and minutes if not return date
  const date = new Date(timestamp);
  const now = new Date();
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return date.toLocaleDateString();
};

const useData = (id: string) => {
  const {data: messages, refetch, isRefetching} = useGroupMessages(id);
  const {data: addresses} = useGroupParticipantsQuery(id);
  const {client} = useClient();
  const {data: group} = useGroup(id);

  return {
    name: group?.id,
    myAddress: client?.address,
    messages,
    refetch,
    isRefetching,
    group,
    client,
    addresses,
  };
};

const getInitialConsentState = (
  addresses: string,
  groupId: string,
): 'allowed' | 'denied' | 'unknown' => {
  const cachedConsent = mmkvStorage.getConsent(addresses, groupId);
  // if (cachedConsent === undefined) {
  //   return 'unknown';
  // }
  // if (cachedConsent) {
  //   return 'allowed';
  // }
  // return 'denied';
  return cachedConsent ? 'allowed' : 'allowed';
};

export const GroupScreen = () => {
  const {params} = useRoute();
  const {id} = params as {id: string};
  const {myAddress, messages, addresses, group, client, refetch, isRefetching} =
    useData(id);
  const [showReply, setShowReply] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [consent, setConsent] = useState<'allowed' | 'denied' | 'unknown'>(
    getInitialConsentState(myAddress ?? '', group?.id ?? ''),
  );
  const {ids, entities} = messages ?? {};

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

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const sendMessage = useCallback(
    async (payload: {text?: string; asset?: Asset}) => {
      if (!group) {
        return;
      }
      if (payload.text) {
        group?.send(payload.text);
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
              group?.send({remoteAttachment: remote});
            });
          })
          .catch(() => {});
      }
    },
    [client, group],
  );

  const renderItem: ListRenderItem<string> = ({item}) => {
    const message = entities?.[item];
    if (!message) {
      return null;
    }
    const isMe =
      message.senderAddress?.toLocaleLowerCase() ===
      myAddress?.toLocaleLowerCase();
    return (
      <Pressable>
        <Box marginLeft={6} marginRight={6} marginY={2} flexShrink={1}>
          <VStack>
            {!isMe && (
              <VStack justifyItems={'flex-end'}>
                <Text
                  color={colors.primaryN200}
                  textAlign={'end'}
                  typography="text-xs/semi-bold"
                  alignSelf={'flex-start'}>
                  {mmkvStorage.getEnsName(message.senderAddress) ??
                    formatAddress(message.senderAddress)}
                </Text>
              </VStack>
            )}
            <ConversationMessageContent message={message} isMe={isMe} />
            <Text
              flexShrink={1}
              color={colors.primaryN200}
              typography="text-xs/semi-bold"
              alignSelf={
                message.contentTypeId === ContentTypes.GroupMembershipChange
                  ? 'center'
                  : isMe
                  ? 'flex-end'
                  : 'flex-start'
              }>
              {getTimestamp(message.sent)}
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
    mmkvStorage.saveConsent(myAddress ?? '', id ?? '', true);
  }, [addresses, client?.contacts, myAddress, id]);

  const onBlock = useCallback(() => {
    if (addresses) {
      client?.contacts.deny(addresses);
    }
    setConsent('denied');
    mmkvStorage.saveConsent(myAddress ?? '', id ?? '', false);
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
            groupId={group?.id ?? ''}
            peerAddresses={addresses ?? []}
            onGroupPress={() => setShowGroupModal(true)}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{height: '100%'}}
            keyboardVerticalOffset={10}>
            <Box flex={1}>
              <FlatList
                keyExtractor={keyExtractor}
                inverted
                data={ids}
                renderItem={renderItem}
                ListFooterComponent={<Box height={'100px'} />}
                onRefresh={refetch}
                refreshing={isRefetching}
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
      <GroupInfoModal
        shown={showGroupModal}
        hide={() => setShowGroupModal(false)}
        addresses={addresses ?? []}
        onPlusPress={() => {
          setShowGroupModal(false);
          setShowAddModal(true);
        }}
        group={group!}
      />
      <AddGroupParticipantModal
        shown={showAddModal}
        hide={() => setShowAddModal(false)}
        group={group!}
      />
    </>
  );
};
