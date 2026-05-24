export interface ApiEnvelope<T> {
  code: number;
  message: string;
  data: T;
  requestId?: string | null;
}

export interface LoginRequest {
  account: string;
  password: string;
}

export interface LoginSession {
  accessToken: string;
  userId: number;
  username: string;
  displayName?: string;
  role: 'USER' | 'ADMIN' | string;
  communityLevel?: number;
  experiencePoints?: number;
  dailyRewardApplied?: boolean;
  dailyExperienceDelta?: number;
}

export interface PostSummary {
  postId: number;
  authorId: number;
  authorName: string;
  authorAvatarUrl: string;
  title: string;
  summary: string;
  languageCode: string;
  categoryCode: string;
  coverImageUrl: string | null;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  viewCount: number;
  hotScore: number;
}

export interface PostDetail extends PostSummary {
  authorId: number;
  content: string;
  contentFormat: 'MARKDOWN' | 'TEXT' | string;
}

export interface CreatePostRequest {
  categoryId: number;
  originalLanguage: string;
  coverImageUrl?: string | null;
  title: string;
  summary: string;
  content: string;
}

export interface UploadedFile {
  fileId: number;
  originalFilename: string;
  filename: string;
  url: string;
  contentType: string | null;
  size: number;
}

export interface PostInteractionState {
  liked: boolean;
  favorited: boolean;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  viewCount: number;
}

export interface CommentItem {
  commentId: number;
  postId: number;
  userId: number;
  languageCode: string;
  content: string;
  createdTime: string;
}

export interface ReportSubmission {
  reportId: number;
  status: string;
}

export interface AiResult {
  type: string;
  languageCode: string;
  text: string;
}

export interface AiLogItem {
  logId: number;
  postId: number;
  aiType: string;
  responseText: string;
  success: number;
  createdTime: string;
}

export interface VoiceResult {
  audioDataUrl: string;
  format: string;
}

export interface HelpRequest {
  helpId: number;
  userId: number;
  title: string;
  description: string;
  categoryId: number | null;
  status: string;
  rewardPoints: number;
  createdTime: string;
}

export interface HelpAnswer {
  answerId: number;
  helpId: number;
  userId: number;
  content: string;
  accepted: number;
  createdTime: string;
}

export interface TopicCategory {
  code: string;
  name: string;
  description: string;
  accent: string;
}

export interface UserProfile {
  userId: number;
  username: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  bannerUrl: string;
  communityLevel: number;
  experiencePoints: number;
  nextLevelExperience: number;
  reputationScore: number;
  postCount: number;
  favoriteCount: number;
  historyCount: number;
  followerCount: number;
  followingCount: number;
  friendCount: number;
  commentCount: number;
  receivedLikeCount: number;
  followedByViewer: boolean;
  friendStatus: 'SELF' | 'NONE' | 'PENDING_SENT' | 'PENDING_RECEIVED' | 'FRIEND' | string;
  friendRequestId: number | null;
  self: boolean;
}

export interface SocialUser {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string;
  communityLevel: number;
  bio: string;
  followedByViewer: boolean;
}

export interface FriendRequest {
  requestId: number;
  requester: SocialUser;
  addressee: SocialUser;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | string;
  createdTime: string | null;
  processedTime: string | null;
}

export interface FriendMessage {
  messageId: number;
  senderId: number;
  receiverId: number;
  senderName: string;
  senderAvatarUrl: string;
  receiverName: string;
  receiverAvatarUrl: string;
  content: string;
  read: boolean;
  createdTime: string | null;
}

export interface FavoriteCollection {
  collectionId: number;
  userId: number;
  name: string;
  description: string;
  visibility: 'PUBLIC' | 'PRIVATE' | string;
  itemCount: number;
  createdTime: string;
}
