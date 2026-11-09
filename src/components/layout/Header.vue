<script setup lang="ts">
import { ElMessageBox, ElMessage } from 'element-plus';
import { useUserInfoStore } from "@/stores/userInfo";
import { adminLogoutService } from "@/api/user";
import router from '@/router';
const userInfoStore = useUserInfoStore();
const logout = () => {
  ElMessageBox.confirm("你確認要登出嗎?", "溫馨提示", {
    confirmButtonText: "確定",
    cancelButtonText: "取消",
    type: "warning",
  })
    .then(async () => {
      //登出
      await adminLogoutService();
      localStorage.removeItem("deviceId");
      //1.清空pinia中儲存的token及個人訊息
      userInfoStore.removeInfo();
      //2.跳轉道登入頁面
      router.push("/admin/login");
      //調用接口
      ElMessage({
        type: "success",
        message: "登出成功",
      });
    })
    .catch(() => {
      // 用戶取消了操作，不需要做事，但避免 Promise 拋錯
      // console.log("使用者取消登出");
    });
}
</script>
<template>
  <div class="ms-auto">
    <ul class="list-unstyled">
      <li class="dropdown pc-h-item">
        <a class="pc-head-link dropdown-toggle arrow-none me-0" data-bs-toggle="dropdown" href="#" role="button"
          aria-haspopup="false" aria-expanded="false">
          <i class="ti ti-mail"></i>
        </a>
        <div class="dropdown-menu dropdown-notification dropdown-menu-end pc-h-dropdown">
          <div class="dropdown-header d-flex align-items-center justify-content-between">
            <h5 class="m-0">Message</h5>
            <a href="#!" @click.prevent class="pc-head-link bg-transparent"><i class="ti ti-x text-danger"></i></a>
          </div>
          <div class="dropdown-divider"></div>
          <div class="dropdown-header px-0 text-wrap header-notification-scroll position-relative"
            style="max-height: calc(100vh - 215px)">
            <div class="list-group list-group-flush w-100">
              <a class="list-group-item list-group-item-action">
                <div class="d-flex">
                  <div class="flex-shrink-0">
                    <img src="@/assets/images/user/avatar-2.jpg" alt="user-image" class="user-avtar">
                  </div>
                  <div class="flex-grow-1 ms-1">
                    <span class="float-end text-muted">3:00 AM</span>
                    <p class="text-body mb-1">It's <b>Cristina danny's</b> birthday today.</p>
                    <span class="text-muted">2 min ago</span>
                  </div>
                </div>
              </a>
              <a class="list-group-item list-group-item-action">
                <div class="d-flex">
                  <div class="flex-shrink-0">
                    <img src="@/assets/images/user/avatar-1.jpg" alt="user-image" class="user-avtar">
                  </div>
                  <div class="flex-grow-1 ms-1">
                    <span class="float-end text-muted">6:00 PM</span>
                    <p class="text-body mb-1"><b>Aida Burg</b> commented your post.</p>
                    <span class="text-muted">5 August</span>
                  </div>
                </div>
              </a>
              <a class="list-group-item list-group-item-action">
                <div class="d-flex">
                  <div class="flex-shrink-0">
                    <img src="@/assets/images/user/avatar-3.jpg" alt="user-image" class="user-avtar">
                  </div>
                  <div class="flex-grow-1 ms-1">
                    <span class="float-end text-muted">2:45 PM</span>
                    <p class="text-body mb-1"><b>There was a failure to your setup.</b></p>
                    <span class="text-muted">7 hours ago</span>
                  </div>
                </div>
              </a>
              <a class="list-group-item list-group-item-action">
                <div class="d-flex">
                  <div class="flex-shrink-0">
                    <img src="@/assets/images/user/avatar-4.jpg" alt="user-image" class="user-avtar">
                  </div>
                  <div class="flex-grow-1 ms-1">
                    <span class="float-end text-muted">9:10 PM</span>
                    <p class="text-body mb-1"><b>Cristina Danny </b> invited to join <b> Meeting.</b></p>
                    <span class="text-muted">Daily scrum meeting time</span>
                  </div>
                </div>
              </a>
            </div>
          </div>
          <div class="dropdown-divider"></div>
          <div class="text-center py-2">
            <a href="#!" @click.prevent class="link-primary">View all</a>
          </div>
        </div>
      </li>
      <li class="dropdown pc-h-item header-user-profile">
        <a class="pc-head-link dropdown-toggle arrow-none me-0" data-bs-toggle="dropdown" href="#" role="button"
          aria-haspopup="false" data-bs-auto-close="outside" aria-expanded="false">
          <img src="@/assets/images/user/avatar-2.jpg" alt="user-image" class="user-avtar">
          <span>{{ userInfoStore.info?.firstName
                  }}{{ userInfoStore.info?.lastName }}</span>
        </a>
        <div class="dropdown-menu dropdown-user-profile dropdown-menu-end pc-h-dropdown">
          <div class="dropdown-header">
            <div class="d-flex mb-1">
              <div class="flex-shrink-0">
                <img src="@/assets/images/user/avatar-2.jpg" alt="user-image" class="user-avtar wid-35">
              </div>
              <div class="flex-grow-1 ms-3">
                <h6 class="mb-1">{{ userInfoStore.info?.firstName
                  }}{{ userInfoStore.info?.lastName }}</h6>
                <span>UI/UX Designer</span>
              </div>
              <a href="#!" @click.prevent class="pc-head-link bg-transparent"><i
                  class="ti ti-power text-danger"></i></a>
            </div>
          </div>
          <ul class="nav drp-tabs nav-fill nav-tabs" id="mydrpTab" role="tablist">
            <li class="nav-item" role="presentation">
              <button class="nav-link active" id="drp-t1" data-bs-toggle="tab" data-bs-target="#drp-tab-1" type="button"
                role="tab" aria-controls="drp-tab-1" aria-selected="true"><i class="ti ti-user"></i> Profile</button>
            </li>
            <li class="nav-item" role="presentation">
              <button class="nav-link" id="drp-t2" data-bs-toggle="tab" data-bs-target="#drp-tab-2" type="button"
                role="tab" aria-controls="drp-tab-2" aria-selected="false"><i class="ti ti-settings"></i>
                Setting</button>
            </li>
          </ul>
          <div class="tab-content" id="mysrpTabContent">
            <div class="tab-pane fade show active" id="drp-tab-1" role="tabpanel" aria-labelledby="drp-t1" tabindex="0">
              <router-link to="/admin/user/resetPassword"  @click.prevent class="dropdown-item">
                <i class="ti ti-edit-circle"></i>
                <span>基本資料</span>
              </router-link>
              <router-link to="/admin/user/info" @click.prevent class="dropdown-item">
                <i class="ti ti-user"></i>
                <span>修改密碼</span>
              </router-link>
              <!-- <a href="#!" @click.prevent class="dropdown-item">
                <i class="ti ti-clipboard-list"></i>
                <span>Social Profile</span>
              </a>
              <a href="#!" @click.prevent class="dropdown-item">
                <i class="ti ti-wallet"></i>
                <span>Billing</span>
              </a> -->
              <a href="#!" @click.prevent class="dropdown-item" @click="logout">
                <i class="ti ti-power"></i>
                <span>Logout</span>
              </a>
            </div>
            <div class="tab-pane fade" id="drp-tab-2" role="tabpanel" aria-labelledby="drp-t2" tabindex="0">
              <a href="#!" @click.prevent class="dropdown-item">
                <i class="ti ti-help"></i>
                <span>Support</span>
              </a>
              <a href="#!" @click.prevent class="dropdown-item">
                <i class="ti ti-user"></i>
                <span>Account Settings</span>
              </a>
              <a href="#!" @click.prevent class="dropdown-item">
                <i class="ti ti-lock"></i>
                <span>Privacy Center</span>
              </a>
              <a href="#!" @click.prevent class="dropdown-item">
                <i class="ti ti-messages"></i>
                <span>Feedback</span>
              </a>
              <a href="#!" @click.prevent class="dropdown-item">
                <i class="ti ti-list"></i>
                <span>History</span>
              </a>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
