<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import {
  Archive,
  ArchiveRestore,
  CircleCheck,
  CircleOff,
  EyeOff,
  FileText,
  Flag,
  Pin,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  Users
} from '@lucide/vue';
import {
  getAdminOverview,
  getAdminPosts,
  getAdminUsers,
  getReports,
  reviewReport as reviewReportApi,
  updatePostFeatured,
  updatePostStatus,
  updateUserStatus
} from '@/api/community';
import EmptyState from '@/components/EmptyState.vue';
import LoadingState from '@/components/LoadingState.vue';
import MarkdownRenderer from '@/components/MarkdownRenderer.vue';
import type { AdminOverview, AdminPost, AdminReport, AdminUser } from '@/types/api';

type TabKey = 'reports' | 'posts' | 'users';

const activeTab = ref<TabKey>('reports');
const overview = ref<AdminOverview | null>(null);
const posts = ref<AdminPost[]>([]);
const reports = ref<AdminReport[]>([]);
const users = ref<AdminUser[]>([]);
const selectedPost = ref<AdminPost | null>(null);
const loading = ref(false);
const busyKey = ref('');
const errorMessage = ref('');
const successMessage = ref('');
const actionRemark = ref('');

const filters = reactive({
  postStatus: 'ALL',
  reportStatus: 'PENDING',
  userStatus: 'ALL',
  keyword: '',
  limit: 50
});

const tabs = [
  { key: 'reports', label: '举报审核', icon: Flag },
  { key: 'posts', label: '帖子管理', icon: FileText },
  { key: 'users', label: '账号信息', icon: Users }
] as const;

const postStatusOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'PUBLISHED', label: '已发布' },
  { value: 'ARCHIVED', label: '已下架' },
  { value: 'REPORTED', label: '被标记' },
  { value: 'DRAFT', label: '草稿' }
];

const reportStatusOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'PENDING', label: '待处理' },
  { value: 'ACCEPTED', label: '已处理' },
  { value: 'REJECTED', label: '已驳回' }
];

const userStatusOptions = [
  { value: 'ALL', label: '全部' },
  { value: 'ACTIVE', label: '正常' },
  { value: 'DISABLED', label: '已停用' },
  { value: 'LOCKED', label: '已锁定' }
];

const pendingReportCount = computed(() => reports.value.filter((report) => report.status === 'PENDING').length);

async function loadOverview() {
  overview.value = await getAdminOverview();
}

async function loadPosts() {
  const data = await getAdminPosts({
    status: filters.postStatus,
    keyword: filters.keyword,
    limit: filters.limit
  });
  posts.value = data;

  if (!selectedPost.value || !data.some((post) => post.postId === selectedPost.value?.postId)) {
    selectedPost.value = data[0] ?? null;
  } else {
    selectedPost.value = data.find((post) => post.postId === selectedPost.value?.postId) ?? selectedPost.value;
  }
}

async function loadReports() {
  reports.value = await getReports({
    status: filters.reportStatus,
    limit: filters.limit
  });
}

async function loadUsers() {
  users.value = await getAdminUsers({
    status: filters.userStatus,
    keyword: filters.keyword,
    limit: filters.limit
  });
}

async function loadAll() {
  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    await Promise.all([loadOverview(), loadPosts(), loadReports(), loadUsers()]);
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '社区管理数据暂时没取到';
  } finally {
    loading.value = false;
  }
}

async function reloadCurrentTab() {
  loading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    if (activeTab.value === 'posts') {
      await loadPosts();
    } else if (activeTab.value === 'reports') {
      await loadReports();
    } else {
      await loadUsers();
    }
    await loadOverview();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '刷新失败';
  } finally {
    loading.value = false;
  }
}

function selectPost(post: AdminPost) {
  selectedPost.value = post;
}

async function setFeatured(post: AdminPost, featured: boolean) {
  await runAction(`feature-${post.postId}`, async () => {
    const next = await updatePostFeatured(post.postId, featured, actionRemark.value);
    replacePost(next);
    successMessage.value = featured ? '文章已置顶' : '文章已取消置顶';
    await loadOverview();
  });
}

async function setPostStatus(post: AdminPost, status: string) {
  await runAction(`post-status-${post.postId}-${status}`, async () => {
    const next = await updatePostStatus(post.postId, status, actionRemark.value);
    replacePost(next);
    successMessage.value = status === 'ARCHIVED' ? '文章已下架' : '文章状态已更新';
    await loadOverview();
  });
}

async function reviewReport(report: AdminReport, decision: string) {
  await runAction(`report-${report.reportId}-${decision}`, async () => {
    await reviewReportApi(report.reportId, decision, actionRemark.value);
    successMessage.value = decision === 'TAKE_DOWN' ? '举报已通过，文章已下架' : '举报处理完成';
    await Promise.all([loadOverview(), loadPosts(), loadReports()]);
  });
}

async function setUserStatus(user: AdminUser, status: string) {
  await runAction(`user-${user.userId}-${status}`, async () => {
    const next = await updateUserStatus(user.userId, status, actionRemark.value);
    users.value = users.value.map((item) => (item.userId === next.userId ? next : item));
    successMessage.value = '账号状态已更新';
    await loadOverview();
  });
}

async function runAction(key: string, task: () => Promise<void>) {
  busyKey.value = key;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    await task();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : '操作失败';
  } finally {
    busyKey.value = '';
  }
}

function replacePost(next: AdminPost) {
  posts.value = posts.value.map((post) => (post.postId === next.postId ? next : post));
  if (selectedPost.value?.postId === next.postId) {
    selectedPost.value = next;
  }
}

function isBusy(key: string) {
  return busyKey.value === key;
}

function statusClass(status: string) {
  return `state-${status.toLowerCase()}`;
}

function formatDate(value: string | null) {
  if (!value) {
    return '-';
  }
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

onMounted(loadAll);
</script>

<template>
  <section class="page-section">
    <div class="page-header">
      <div class="section-heading">
        <span>Community</span>
        <h1>社区管理</h1>
      </div>

      <div class="toolbar">
        <button class="secondary-button" type="button" :disabled="loading" @click="reloadCurrentTab">
          <RefreshCw :size="17" />
          <span>刷新</span>
        </button>
      </div>
    </div>

    <div class="metric-grid">
      <div class="metric-card">
        <Users :size="20" />
        <span>账号</span>
        <strong>{{ overview ? `${overview.activeUsers}/${overview.totalUsers}` : '...' }}</strong>
      </div>
      <div class="metric-card">
        <FileText :size="20" />
        <span>已发布文章</span>
        <strong>{{ overview?.publishedPosts ?? '...' }}</strong>
      </div>
      <div class="metric-card">
        <Flag :size="20" />
        <span>待处理举报</span>
        <strong>{{ overview?.pendingReports ?? pendingReportCount }}</strong>
      </div>
      <div class="metric-card">
        <Pin :size="20" />
        <span>置顶文章</span>
        <strong>{{ overview?.featuredPosts ?? '...' }}</strong>
      </div>
    </div>

    <div class="tab-bar" role="tablist" aria-label="社区管理">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        :class="{ active: activeTab === tab.key }"
        @click="activeTab = tab.key"
      >
        <component :is="tab.icon" :size="17" />
        <span>{{ tab.label }}</span>
      </button>
    </div>

    <div class="management-toolbar">
      <label v-if="activeTab === 'posts'" class="select-field">
        <span>帖子状态</span>
        <select v-model="filters.postStatus" @change="reloadCurrentTab">
          <option v-for="option in postStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="activeTab === 'reports'" class="select-field">
        <span>举报状态</span>
        <select v-model="filters.reportStatus" @change="reloadCurrentTab">
          <option v-for="option in reportStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="activeTab === 'users'" class="select-field">
        <span>账号状态</span>
        <select v-model="filters.userStatus" @change="reloadCurrentTab">
          <option v-for="option in userStatusOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </option>
        </select>
      </label>

      <label v-if="activeTab !== 'reports'" class="inline-input wide-input">
        <Search :size="17" />
        <span>搜索</span>
        <input v-model.trim="filters.keyword" type="search" placeholder="标题、作者、账号或邮箱" @keyup.enter="reloadCurrentTab" />
      </label>

      <label class="inline-input">
        <span>数量</span>
        <input v-model.number="filters.limit" type="number" min="1" max="100" @change="reloadCurrentTab" />
      </label>
    </div>

    <label class="moderation-remark">
      <span>处理备注</span>
      <input v-model.trim="actionRemark" type="text" placeholder="可填写下架原因、驳回原因或账号处理说明" />
    </label>

    <LoadingState v-if="loading" label="正在读取社区数据" />
    <p v-else-if="errorMessage" class="form-error">{{ errorMessage }}</p>
    <p v-else-if="successMessage" class="form-success">{{ successMessage }}</p>

    <div v-if="activeTab === 'reports'" class="table-surface">
      <table>
        <thead>
          <tr>
            <th>举报内容</th>
            <th>举报人</th>
            <th>风险</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="report in reports" :key="report.reportId">
            <td class="wide-cell">
              <strong>{{ report.postTitle || `文章 #${report.postId}` }}</strong>
              <small>{{ report.reason }}</small>
              <span class="muted-line">{{ report.aiSuggestion }}</span>
            </td>
            <td>
              <strong>{{ report.reporterName }}</strong>
              <small>#{{ report.reporterId }} · {{ formatDate(report.createdTime) }}</small>
            </td>
            <td>
              <span class="state-badge" :class="statusClass(report.aiRiskLevel || 'LOW')">{{ report.aiRiskLevel || 'LOW' }}</span>
            </td>
            <td>
              <span class="state-badge" :class="statusClass(report.status)">{{ report.status }}</span>
              <small v-if="report.processedByName">{{ report.processedByName }} · {{ formatDate(report.processedTime) }}</small>
            </td>
            <td>
              <div class="table-actions">
                <button
                  class="secondary-button danger-action"
                  type="button"
                  :disabled="report.status !== 'PENDING' || isBusy(`report-${report.reportId}-TAKE_DOWN`)"
                  @click="reviewReport(report, 'TAKE_DOWN')"
                >
                  <EyeOff :size="16" />
                  <span>下架</span>
                </button>
                <button
                  class="secondary-button"
                  type="button"
                  :disabled="report.status !== 'PENDING' || isBusy(`report-${report.reportId}-DISMISS`)"
                  @click="reviewReport(report, 'DISMISS')"
                >
                  <CircleOff :size="16" />
                  <span>驳回</span>
                </button>
                <button
                  v-if="report.postStatus !== 'PUBLISHED'"
                  class="secondary-button"
                  type="button"
                  :disabled="isBusy(`report-${report.reportId}-RESTORE`)"
                  @click="reviewReport(report, 'RESTORE')"
                >
                  <ArchiveRestore :size="16" />
                  <span>恢复</span>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="reports.length === 0" title="没有举报记录" description="当前筛选条件下没有需要处理的举报。" />
    </div>

    <div v-else-if="activeTab === 'posts'" class="management-grid">
      <div class="table-surface">
        <table>
          <thead>
            <tr>
              <th>文章</th>
              <th>作者</th>
              <th>状态</th>
              <th>数据</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="post in posts" :key="post.postId" :class="{ selected: selectedPost?.postId === post.postId }">
              <td class="wide-cell">
                <button class="text-button" type="button" @click="selectPost(post)">
                  {{ post.title }}
                </button>
                <small>{{ post.summary }}</small>
              </td>
              <td>
                <strong>{{ post.authorName }}</strong>
                <small>#{{ post.authorId }} · {{ post.languageCode }}</small>
              </td>
              <td>
                <span class="state-badge" :class="statusClass(post.status)">{{ post.status }}</span>
                <span v-if="post.featured" class="state-badge state-featured">置顶</span>
              </td>
              <td>
                <small>{{ post.likeCount }} 赞 · {{ post.commentCount }} 评</small>
                <small>{{ post.viewCount }} 阅读</small>
              </td>
              <td>
                <div class="table-actions">
                  <button class="secondary-button" type="button" @click="selectPost(post)">
                    <FileText :size="16" />
                    <span>预览</span>
                  </button>
                  <button class="secondary-button" type="button" :disabled="isBusy(`feature-${post.postId}`)" @click="setFeatured(post, !post.featured)">
                    <Pin :size="16" />
                    <span>{{ post.featured ? '取消' : '置顶' }}</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        <EmptyState v-if="posts.length === 0" title="没有文章" description="当前筛选条件下没有可管理的文章。" />
      </div>

      <aside v-if="selectedPost" class="management-preview">
        <div class="preview-header">
          <div>
            <span class="state-badge" :class="statusClass(selectedPost.status)">{{ selectedPost.status }}</span>
            <span v-if="selectedPost.featured" class="state-badge state-featured">置顶</span>
          </div>
          <RouterLink class="secondary-button" :to="`/posts/${selectedPost.postId}`">
            打开详情
          </RouterLink>
        </div>
        <h2>{{ selectedPost.title }}</h2>
        <p>{{ selectedPost.summary }}</p>
        <div class="preview-actions">
          <button class="secondary-button" type="button" :disabled="isBusy(`feature-${selectedPost.postId}`)" @click="setFeatured(selectedPost, !selectedPost.featured)">
            <Pin :size="16" />
            <span>{{ selectedPost.featured ? '取消置顶' : '置顶文章' }}</span>
          </button>
          <button class="secondary-button danger-action" type="button" :disabled="selectedPost.status === 'ARCHIVED'" @click="setPostStatus(selectedPost, 'ARCHIVED')">
            <Archive :size="16" />
            <span>下架</span>
          </button>
          <button class="secondary-button" type="button" :disabled="selectedPost.status === 'PUBLISHED'" @click="setPostStatus(selectedPost, 'PUBLISHED')">
            <CircleCheck :size="16" />
            <span>发布</span>
          </button>
        </div>
        <MarkdownRenderer class="admin-markdown" :content="selectedPost.content" />
      </aside>
    </div>

    <div v-else class="table-surface">
      <table>
        <thead>
          <tr>
            <th>账号</th>
            <th>联系方式</th>
            <th>等级</th>
            <th>社区数据</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.userId">
            <td>
              <strong>{{ user.displayName || user.username }}</strong>
              <small>@{{ user.username }} · #{{ user.userId }}</small>
            </td>
            <td>
              <span>{{ user.email }}</span>
              <small>{{ user.role }}</small>
            </td>
            <td>
              <strong>Lv.{{ user.communityLevel }}</strong>
              <small>{{ user.experiencePoints }} XP · 声望 {{ user.reputationScore }}</small>
            </td>
            <td>
              <small>{{ user.postCount }} 篇文章 · {{ user.commentCount }} 条评论</small>
              <small>{{ user.favoriteCount }} 收藏 · {{ user.followerCount }} 关注者</small>
            </td>
            <td>
              <span class="state-badge" :class="statusClass(user.status)">{{ user.status }}</span>
              <small>{{ formatDate(user.createdTime) }} 加入</small>
            </td>
            <td>
              <div v-if="user.role !== 'ADMIN'" class="table-actions">
                <button class="secondary-button" type="button" :disabled="user.status === 'ACTIVE'" @click="setUserStatus(user, 'ACTIVE')">
                  <CircleCheck :size="16" />
                  <span>恢复</span>
                </button>
                <button class="secondary-button" type="button" :disabled="user.status === 'LOCKED'" @click="setUserStatus(user, 'LOCKED')">
                  <UserCog :size="16" />
                  <span>锁定</span>
                </button>
                <button class="secondary-button danger-action" type="button" :disabled="user.status === 'DISABLED'" @click="setUserStatus(user, 'DISABLED')">
                  <ShieldCheck :size="16" />
                  <span>停用</span>
                </button>
              </div>
              <span v-else class="muted-line">管理员账号</span>
            </td>
          </tr>
        </tbody>
      </table>
      <EmptyState v-if="users.length === 0" title="没有账号" description="当前筛选条件下没有账号记录。" />
    </div>
  </section>
</template>
