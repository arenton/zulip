"use strict";

const {strict: assert} = require("assert");

const _ = require("lodash");

const {mock_esm, with_field, zrequire} = require("../zjsunit/namespace");
const {run_test} = require("../zjsunit/test");
const blueslip = require("../zjsunit/zblueslip");
const {page_params, user_settings} = require("../zjsunit/zpage_params");

const timerender = mock_esm("../../static/js/timerender");

const compose_fade_helper = zrequire("compose_fade_helper");
const muted_users = zrequire("muted_users");
const peer_data = zrequire("peer_data");
const people = zrequire("people");
const presence = zrequire("presence");
const stream_data = zrequire("stream_data");
const user_status = zrequire("user_status");
const buddy_data = zrequire("buddy_data");

// The buddy_data module is mostly tested indirectly through
// activity.js, but we should feel free to add direct tests
// here.

const selma = {
    user_id: 1000,
    full_name: "Human Selma",
    email: "selma@example.com",
};

const me = {
    user_id: 1001,
    full_name: "Human Myself",
    email: "self@example.com",
};

const alice = {
    email: "alice@zulip.com",
    user_id: 1002,
    full_name: "Alice Smith",
};

const fred = {
    email: "fred@zulip.com",
    user_id: 1003,
    full_name: "Fred Flintstone",
};

const jill = {
    email: "jill@zulip.com",
    user_id: 1004,
    full_name: "Jill Hill",
};

const mark = {
    email: "mark@zulip.com",
    user_id: 1005,
    full_name: "Marky Mark",
};

const old_user = {
    user_id: 9999,
    full_name: "Old User",
    email: "old_user@example.com",
};

const bot = {
    user_id: 55555,
    full_name: "Red Herring Bot",
    email: "bot@example.com",
    is_bot: true,
    bot_owner_id: null,
};

const bot_with_owner = {
    user_id: 55556,
    full_name: "Blue Herring Bot",
    email: "bot_with_owner@example.com",
    is_bot: true,
    bot_owner_id: 1001,
    bot_owner_full_name: "Human Myself",
};

function add_canned_users() {
    people.add_active_user(alice);
    people.add_active_user(bot);
    people.add_active_user(bot_with_owner);
    people.add_active_user(fred);
    people.add_active_user(jill);
    people.add_active_user(mark);
    people.add_active_user(old_user);
    people.add_active_user(selma);
}

function test(label, f) {
    run_test(label, ({override}) => {
        compose_fade_helper.clear_focused_recipient();
        stream_data.clear_subscriptions();
        peer_data.clear_for_testing();
        user_status.initialize({user_status: {}});
        presence.presence_info.clear();
        people.init();
        people.add_active_user(me);
        people.initialize_current_user(me.user_id);
        muted_users.set_muted_users([]);
        f({override});
    });
}

test("huddle_fraction_present", () => {
    people.add_active_user(alice);
    people.add_active_user(fred);
    people.add_active_user(jill);
    people.add_active_user(mark);

    let huddle = "alice@zulip.com,fred@zulip.com,jill@zulip.com,mark@zulip.com";
    huddle = people.emails_strings_to_user_ids_string(huddle);

    let presence_info = new Map();
    presence_info.set(alice.user_id, {status: "active"}); // counts as present
    presence_info.set(fred.user_id, {status: "idle"}); // does not count as present
    // jill not in list
    presence_info.set(mark.user_id, {status: "offline"}); // does not count
    presence.__Rewire__("presence_info", presence_info);

    assert.equal(buddy_data.huddle_fraction_present(huddle), 0.5);

    presence_info = new Map();
    for (const user of [alice, fred, jill, mark]) {
        presence_info.set(user.user_id, {status: "active"}); // counts as present
    }
    presence.__Rewire__("presence_info", presence_info);

    assert.equal(buddy_data.huddle_fraction_present(huddle), 1);

    huddle = "alice@zulip.com,fred@zulip.com,jill@zulip.com,mark@zulip.com";
    huddle = people.emails_strings_to_user_ids_string(huddle);
    presence_info = new Map();
    presence_info.set(alice.user_id, {status: "idle"});
    presence_info.set(fred.user_id, {status: "idle"}); // does not count as present
    // jill not in list
    presence_info.set(mark.user_id, {status: "offline"}); // does not count
    presence.__Rewire__("presence_info", presence_info);

    assert.equal(buddy_data.huddle_fraction_present(huddle), undefined);
});

function set_presence(user_id, status) {
    presence.presence_info.set(user_id, {
        status,
        last_active: 9999,
    });
}

test("user_circle, level, status_description", () => {
    add_canned_users();

    set_presence(selma.user_id, "active");
    assert.equal(buddy_data.get_user_circle_class(selma.user_id), "user_circle_green");
    user_status.set_away(selma.user_id);
    assert.equal(buddy_data.level(selma.user_id), 3);

    assert.equal(buddy_data.get_user_circle_class(selma.user_id), "user_circle_empty_line");
    user_status.revoke_away(selma.user_id);
    assert.equal(buddy_data.get_user_circle_class(selma.user_id), "user_circle_green");
    assert.equal(buddy_data.status_description(selma.user_id), "translated: Active");

    set_presence(me.user_id, "active");
    assert.equal(buddy_data.get_user_circle_class(me.user_id), "user_circle_green");
    user_status.set_away(me.user_id);
    assert.equal(buddy_data.status_description(me.user_id), "translated: Unavailable");
    assert.equal(buddy_data.level(me.user_id), 0);

    assert.equal(buddy_data.get_user_circle_class(me.user_id), "user_circle_empty_line");
    user_status.revoke_away(me.user_id);
    assert.equal(buddy_data.get_user_circle_class(me.user_id), "user_circle_green");

    set_presence(fred.user_id, "idle");
    assert.equal(buddy_data.get_user_circle_class(fred.user_id), "user_circle_orange");
    assert.equal(buddy_data.level(fred.user_id), 2);
    assert.equal(buddy_data.status_description(fred.user_id), "translated: Idle");

    set_presence(fred.user_id, undefined);
    assert.equal(buddy_data.status_description(fred.user_id), "translated: Offline");
});

test("buddy_status", () => {
    set_presence(selma.user_id, "active");
    set_presence(me.user_id, "active");

    assert.equal(buddy_data.buddy_status(selma.user_id), "active");
    user_status.set_away(selma.user_id);
    assert.equal(buddy_data.buddy_status(selma.user_id), "away_them");
    user_status.revoke_away(selma.user_id);
    assert.equal(buddy_data.buddy_status(selma.user_id), "active");

    assert.equal(buddy_data.buddy_status(me.user_id), "active");
    user_status.set_away(me.user_id);
    assert.equal(buddy_data.buddy_status(me.user_id), "away_me");
    user_status.revoke_away(me.user_id);
    assert.equal(buddy_data.buddy_status(me.user_id), "active");
});

test("title_data", () => {
    add_canned_users();

    // Groups
    let is_group = true;
    const user_ids_string = "9999,1000";
    let expected_group_data = {
        first_line: "Human Selma, Old User",
        second_line: "",
        third_line: "",
    };
    assert.deepEqual(buddy_data.get_title_data(user_ids_string, is_group), expected_group_data);

    is_group = "";

    // Bots with owners.
    expected_group_data = {
        first_line: "Blue Herring Bot",
        second_line: "translated: Owner: Human Myself",
        third_line: "",
    };
    assert.deepEqual(
        buddy_data.get_title_data(bot_with_owner.user_id, is_group),
        expected_group_data,
    );

    // Bots without owners.
    expected_group_data = {
        first_line: "Red Herring Bot",
        second_line: "",
        third_line: "",
    };
    assert.deepEqual(buddy_data.get_title_data(bot.user_id, is_group), expected_group_data);

    // Individual users.
    user_status.set_status_text({
        user_id: me.user_id,
        status_text: "out to lunch",
    });

    let expected_data = {
        first_line: "Human Myself",
        second_line: "out to lunch",
        third_line: "translated: Active now",
        show_you: true,
    };
    page_params.user_id = me.user_id;
    assert.deepEqual(buddy_data.get_title_data(me.user_id, is_group), expected_data);

    expected_data = {
        first_line: "Old User",
        second_line: "translated: Last active: translated: More than 2 weeks ago",
        third_line: "",
        show_you: false,
    };
    assert.deepEqual(buddy_data.get_title_data(old_user.user_id, is_group), expected_data);
});

test("simple search", () => {
    add_canned_users();

    set_presence(selma.user_id, "active");
    set_presence(me.user_id, "active");

    const user_ids = buddy_data.get_filtered_and_sorted_user_ids("sel");

    assert.deepEqual(user_ids, [selma.user_id]);
});

test("muted users excluded from search", () => {
    people.add_active_user(selma);
    muted_users.add_muted_user(selma.user_id);

    let user_ids = buddy_data.get_filtered_and_sorted_user_ids();
    assert.equal(user_ids.includes(selma.user_id), false);
    user_ids = buddy_data.get_filtered_and_sorted_user_ids("sel");
    assert.deepEqual(user_ids, []);
    assert.ok(!buddy_data.matches_filter("sel", selma.user_id));

    muted_users.remove_muted_user(selma.user_id);
    user_ids = buddy_data.get_filtered_and_sorted_user_ids("sel");
    assert.deepEqual(user_ids, [selma.user_id]);
    assert.ok(buddy_data.matches_filter("sel", selma.user_id));
});

test("bulk_data_hacks", () => {
    // sanity check
    assert.equal(mark.user_id, 1005);

    for (const i of _.range(mark.user_id + 1, 2000)) {
        const person = {
            user_id: i,
            full_name: `Human ${i}`,
            email: `person${i}@example.com`,
        };
        people.add_active_user(person);
    }
    add_canned_users();

    // Make 400 of the users active
    set_presence(selma.user_id, "active");
    set_presence(me.user_id, "active");

    for (const user_id of _.range(1000, 1400)) {
        set_presence(user_id, "active");
    }

    // And then 300 not active
    for (const user_id of _.range(1400, 1700)) {
        set_presence(user_id, "offline");
    }

    let user_ids;

    // Even though we have 1000 users, we only get the 400 active
    // users.  This is a consequence of buddy_data.maybe_shrink_list.
    user_ids = buddy_data.get_filtered_and_sorted_user_ids();
    assert.equal(user_ids.length, 400);

    user_ids = buddy_data.get_filtered_and_sorted_user_ids("");
    assert.equal(user_ids.length, 400);

    // We don't match on "so", because it's not at the start of a
    // word in the name/email.
    user_ids = buddy_data.get_filtered_and_sorted_user_ids("so");
    assert.equal(user_ids.length, 0);

    // We match on "h" for the first name, and the result limit
    // is relaxed for searches.  (We exclude "me", though.)
    user_ids = buddy_data.get_filtered_and_sorted_user_ids("h");
    assert.equal(user_ids.length, 996);

    // We match on "p" for the email.
    user_ids = buddy_data.get_filtered_and_sorted_user_ids("p");
    assert.equal(user_ids.length, 994);

    // Make our shrink limit higher, and go back to an empty search.
    // We won't get all 1000 users, just the present ones.
    with_field(buddy_data, "max_size_before_shrinking", 50000, () => {
        user_ids = buddy_data.get_filtered_and_sorted_user_ids("");
    });
    assert.equal(user_ids.length, 700);
});

test("always show me", ({override}) => {
    const present_user_ids = [];
    override(presence, "get_user_ids", () => present_user_ids);
    assert.deepEqual(buddy_data.get_filtered_and_sorted_user_ids(""), [me.user_id]);

    // Make sure we didn't mutate the list passed to us.
    assert.deepEqual(present_user_ids, []);

    // try to make us show twice
    present_user_ids.push(me.user_id);
    assert.deepEqual(buddy_data.get_filtered_and_sorted_user_ids(""), [me.user_id]);
});

test("user_status", () => {
    user_status.initialize({user_status: []});
    set_presence(me.user_id, "active");
    assert.equal(buddy_data.get_my_user_status(me.user_id), "translated: (you)");
    user_status.set_away(me.user_id);
    assert.equal(buddy_data.get_my_user_status(me.user_id), "translated: (unavailable)");
    user_status.revoke_away(me.user_id);
    assert.equal(buddy_data.get_my_user_status(me.user_id), "translated: (you)");
});

test("level", () => {
    add_canned_users();
    assert.equal(buddy_data.level(me.user_id), 0);
    assert.equal(buddy_data.level(selma.user_id), 3);

    const server_time = 9999;
    const info = {
        website: {
            status: "active",
            timestamp: server_time,
        },
    };
    presence.update_info_from_event(me.user_id, info, server_time);
    presence.update_info_from_event(selma.user_id, info, server_time);

    assert.equal(buddy_data.level(me.user_id), 0);
    assert.equal(buddy_data.level(selma.user_id), 1);

    user_status.set_away(me.user_id);
    user_status.set_away(selma.user_id);

    // Selma gets demoted to level 3, but "me"
    // stays in level 0.
    assert.equal(buddy_data.level(me.user_id), 0);
    assert.equal(buddy_data.level(selma.user_id), 3);
});

test("user_last_seen_time_status", ({override}) => {
    set_presence(selma.user_id, "active");
    set_presence(me.user_id, "active");

    assert.equal(buddy_data.user_last_seen_time_status(selma.user_id), "translated: Active now");

    page_params.realm_is_zephyr_mirror_realm = true;
    assert.equal(
        buddy_data.user_last_seen_time_status(old_user.user_id),
        "translated: Last active: translated: Unknown",
    );
    page_params.realm_is_zephyr_mirror_realm = false;
    assert.equal(
        buddy_data.user_last_seen_time_status(old_user.user_id),
        "translated: Last active: translated: More than 2 weeks ago",
    );

    override(presence, "last_active_date", (user_id) => {
        assert.equal(user_id, old_user.user_id);
        return new Date(1526137743000);
    });

    override(timerender, "last_seen_status_from_date", (date) => {
        assert.deepEqual(date, new Date(1526137743000));
        return "May 12";
    });

    assert.equal(
        buddy_data.user_last_seen_time_status(old_user.user_id),
        "translated: Last active: May 12",
    );

    set_presence(selma.user_id, "idle");
    assert.equal(buddy_data.user_last_seen_time_status(selma.user_id), "translated: Idle");
});

test("get_items_for_users", ({override}) => {
    people.add_active_user(alice);
    people.add_active_user(fred);
    user_status.set_away(alice.user_id);
    user_settings.emojiset = "google";
    const status_emoji_info = {
        emoji_name: "car",
        emoji_code: "1f697",
        reaction_type: "unicode_emoji",
    };
    override(user_status, "get_status_emoji", () => status_emoji_info);

    const user_ids = [me.user_id, alice.user_id, fred.user_id];
    assert.deepEqual(buddy_data.get_items_for_users(user_ids), [
        {
            href: "#narrow/pm-with/1001-self",
            is_current_user: true,
            my_user_status: "translated: (you)",
            name: "Human Myself",
            num_unread: 0,
            status_emoji_info,
            user_circle_class: "user_circle_green",
            user_circle_status: "translated: Active",
            user_id: 1001,
        },
        {
            href: "#narrow/pm-with/1002-alice",
            is_current_user: false,
            my_user_status: undefined,
            name: "Alice Smith",
            num_unread: 0,
            status_emoji_info,
            user_circle_class: "user_circle_empty_line",
            user_circle_status: "translated: Unavailable",
            user_id: 1002,
        },
        {
            href: "#narrow/pm-with/1003-fred",
            is_current_user: false,
            my_user_status: undefined,
            name: "Fred Flintstone",
            num_unread: 0,
            status_emoji_info,
            user_circle_class: "user_circle_empty",
            user_circle_status: "translated: Offline",
            user_id: 1003,
        },
    ]);
});

test("error handling", ({override}) => {
    override(presence, "get_user_ids", () => [42]);
    blueslip.expect("error", "Unknown user_id in get_by_user_id: 42");
    blueslip.expect("warn", "Got user_id in presence but not people: 42");
    buddy_data.get_filtered_and_sorted_user_ids();
});
