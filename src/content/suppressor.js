/**
 * 「次の 1 回だけ」イベントを抑止するフラグ。
 *
 * TTL を持たせているのは、フラグが残留して右クリックメニューが
 * 恒久的に出なくなる事故を防ぐため。最悪でも ttlMs 経過後には
 * 自動的に無効化される。
 *
 * 時刻は引数で受け取る（内部でタイマーを使わない）ため、
 * 純粋ロジックとしてテストできる。
 */
export function createSuppressor({ ttlMs }) {
  let armedAt = null;

  return {
    arm(now) {
      armedAt = now;
    },

    /** 抑止すべきなら true を返し、フラグを消費する。 */
    consume(now) {
      if (armedAt === null) return false;
      const expired = now - armedAt > ttlMs;
      armedAt = null;
      return !expired;
    },

    disarm() {
      armedAt = null;
    },

    get isArmed() {
      return armedAt !== null;
    },
  };
}
