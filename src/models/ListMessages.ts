import {Conversation} from '@xmtp/react-native-sdk';
import {Group} from '@xmtp/react-native-sdk/build/lib/Group';

export interface ListItem {
  lastMessageTime: number;
  display: string;
  isRequest: boolean;
}

/**
 * @deprecated only leaving v3 for now
 */
export interface ListConversation extends ListItem {
  conversation: Conversation<any>;
}

export interface ListGroup extends ListItem {
  group: Group<any>;
}

export type ListMessages = ListGroup[];
