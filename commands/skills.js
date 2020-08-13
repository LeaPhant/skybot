const helper = require('../helper');
const { formatNumber } = helper;
const config = require('../config.json');
const axios = require('axios');
const _ = require('lodash');

const xpMax = {
    25: 3022425,
    30: 8022425,
    35: 15522425,
    40: 25522425,
    45: 38072425,
    50: 55172425
};

const xpMaxRunecrafting = {
    25: 94450
};

const skillsSorted = [
    "taming", "farming", "mining", "combat", "foraging", "fishing", "enchanting", "alchemy", "carpentry", "runecrafting"
];

const statModifier = (value, stat) => {
    let suffix = '';

    switch(stat){
        case 'damage_increase':
            value = Math.floor(value * 100);
        case 'crit_chance':
        case 'crit_damage':
        case 'speed':
        case 'sea_creature_chance':
            suffix = '%';
    }

    return value + suffix;
};

const skillEmbed = (profile, skillName, embed) => {
    const output = JSON.parse(JSON.stringify(embed));

    const skill = profile.data.levels[skillName];
    const name = helper.capitalizeFirstLetter(skillName);

    output.author.name = `${profile.data.display_name}'s ${name} Skill (${profile.cute_name})`;

    const xpMaxRequired = skillName == 'runecrafting' ? xpMaxRunecrafting[skill.maxLevel] : xpMax[skill.maxLevel];

    const currentProgress = Math.floor(skill.xpCurrent / skill.xpForNext * 100);
    const progress = Math.floor(skill.xp / xpMaxRequired * 100);

    output.description = `Level: **${skill.level}** / ${skill.maxLevel} (**#${skill.rank.toLocaleString()}**)\n`;

    if(skill.level == skill.maxLevel)
        output.description += `Current XP: **${Math.floor(skill.xpCurrent).toLocaleString()}**`;
    else
        output.description += `Current XP: **${Math.floor(skill.xpCurrent).toLocaleString()}** / ${skill.xpForNext.toLocaleString()} (**${currentProgress}%**)`;

    output.description += `\nTotal XP: **${Math.floor(skill.xp).toLocaleString()}** / ${xpMaxRequired.toLocaleString()} (**${progress}%**)`;

    let skillContext = false;

    switch(skillName){
        case "taming":
            if('petScore' in profile.data)
                output.description += `\n\nPet Score: **${(profile.data.petScore || 0).toLocaleString()}**`;
            break;
        case "farming":
            if(!('collection' in profile.raw))
                break;

            const collections = [
                "WHEAT", "CARROT_ITEM", "POTATO_ITEM", "PUMPKIN", "MELON", "SEEDS", "MUSHROOM_COLLECTION", "INK_SACK:3", "SUGAR_CANE"
            ];

            let cropsMined = 0;

            for(const cropCollection of _.keys(profile.raw.collection).filter(a => collections.includes(a)))
                cropsMined += profile.raw.collection[cropCollection];

            output.description += `\n\nCrops farmed: **${(cropsMined || 0).toLocaleString()}**`;
            skillContext = true;

            break;
        case "combat":
            output.description += `\n\nMinion Ghast Kills: **${(profile.raw.stats.kills_generator_ghast || 0).toLocaleString()}**`;
            skillContext = true;

            break;
        case "fishing":
            output.description += `\n\nItems fished: **${(profile.raw.stats.items_fished || 0).toLocaleString()}**`;
            skillContext = true;

            break;
        case "alchemy":
            if('collection' in profile.raw){
                output.description += `\n\nSugar Cane Collection: **${(profile.raw.collection.SUGAR_CANE || 0).toLocaleString()}**`;
                skillContext = true;
            }

            break;
        case "mining":
            if('pet_milestone_ores_mined' in profile.raw.stats){
                output.description += `\n\nOres Mined Milestone: **${(profile.raw.stats.pet_milestone_ores_mined || 0).toLocaleString()}**`;
                skillContext = true;
            }

            break;
        case "foraging":
            let logsMined = 0;

            if(!('collection' in profile.raw))
                break;

            for(const logCollection of _.keys(profile.raw.collection).filter(a => a.includes('LOG')))
                logsMined += profile.raw.collection[logCollection];

            output.description += `\n\nLogs collected: **${(logsMined || 0).toLocaleString()}**`;
            skillContext = true;

            break;
        case "enchanting":
            if('collection' in profile.raw){
                output.description += `\n\nLapis Lazuli Collection: **${(profile.raw.collection['INK_SACK:4'] || 0).toLocaleString()}**`;
                skillContext = true;
            }

            break;
    }

    const skillBonus = profile.data.skill_bonus[skillName];
    const bonusKeys = _.pickBy(skillBonus, value => value > 0);

    if(!skillContext)
        output.description += '\n';

    if(_.keys(bonusKeys).length > 0)
        output.description += '\nBonus: ';

    for(const [index, key] of _.keys(bonusKeys).entries()){
        output.description += `**+${statModifier(skillBonus[key], key)}** ${helper.titleCase(key.replace(/\_/g, ' '))}`;

        if(index < _.keys(bonusKeys).length - 1)
            output.description += ', ';
    }

    output.fields = [];

    if(skill.level < skill.maxLevel && skill.maxLevel == 50){
        let levelKeys = _.keys(
            _.pickBy(xpMax, (value, key) => new Number(key) > skill.level)
        ).sort((a, b) => a - b);

        if(levelKeys.length > 3)
            levelKeys = [...levelKeys.slice(0, 2), levelKeys.pop()];

        for(const key of levelKeys)
            output.fields.push({
                inline: true,
                name: `Level ${key}`,
                value: `in **${Math.round(xpMax[key] - skill.xp).toLocaleString()}** XP`
            });
    }

    return output;
};

module.exports = {
    command: ['skills', 's'],
    argsRequired: 1,
    description: [
        "Check skills for a player.",
    ],
    example: [
        {
            run: "skills leaphant",
            result: "Returns skills for LeaPhant."
        }
    ],
    usage: '<username> [profile name] [skill name]',
    call: async obj => {
        const { argv, client, msg, db } = obj;

        const footer = {
            icon_url: "https://cdn.discordapp.com/attachments/572429763700981780/726040184638144512/logo_round.png",
            text: `sky.lea.moe – ${config.prefix}skills <user> [profile] [skill]`
        }

        const message = await msg.channel.send({
            embed : {
                color: 11809405,
                author: {
                    name: `${argv[1]}'s Skills`
                },
                footer,
                description: `Awaiting API response... ${helper.emote('beespin', null, client)}`
            }
        });

        let response;

        try{
            response = await axios.get(`${config.sky_api_base}/api/v2/profile/${argv[1]}`, { params: { key: config.credentials.sky_api_key }});
        }catch(e){
            let error = "Failed retrieving data from API.";

            if(e.response != null && e.response.data != null && 'error' in e.response.data)
                error = e.response.data.error;

            await message.edit({
                embed: {
                    color: 0xf04a4a,
                    author: {
                        name: 'Error'
                    },
                    footer,
                    description: error
                }
            });
        }

        const { data } = response;

        let profile = data.profiles[_.findKey(data.profiles, a => a.current)];
        let customProfile;
        let customSkill;

        if(argv.length > 2 && !skillsSorted.includes(argv[2].toLowerCase())){
            customProfile = argv[2].toLowerCase();

            if(argv.length > 3 && skillsSorted.includes(argv[3].toLowerCase()))
                customSkill = argv[3].toLowerCase();

            for(const key in data.profiles)
                if(data.profiles[key].cute_name.toLowerCase() == customProfile)
                    profile = data.profiles[key];
        }else if(argv.length > 2 && skillsSorted.includes(argv[2].toLowerCase())){
            customSkill = argv[2].toLowerCase();
        }

        const embed = {
            color: 11809405,
            url: `https://sky.lea.moe/stats/${profile.data.uuid}/${profile.data.profile.profile_id}`,
            author: {
                name: `${profile.data.display_name}'s Skills (${profile.cute_name})`,
                url: `https://sky.lea.moe/stats/${profile.data.uuid}/${profile.data.profile.profile_id}`,
            },
            thumbnail: {
                url: `https://minotar.net/helm/${profile.data.uuid}/128`
            },
            footer,
            description:
                `Total Skill XP: **${helper.formatNumber(profile.data.total_skill_xp)}**\n`
              + `Average Skill Level: **${(Math.floor(profile.data.average_level * 100) / 100).toFixed(2)}** (**${(Math.floor(profile.data.average_level_no_progress * 100) / 100).toFixed(2)}**) (**#${helper.formatNumber(profile.data.average_level_rank)}**)`,
            fields: []
        };

        const reactions = [];

        const fields = [];

        for(const [index, skillName] of skillsSorted.entries()){
            const skill = profile.data.levels[skillName];

            if(skill == null)
                continue;

            const name = helper.capitalizeFirstLetter(skillName);
            const skillEmote = helper.emote('sb' + name, null, client);

            const field = {};

            if(msg.channel.name.includes('commands'))
                field['name'] = `${skillEmote.toString()} ${name} **${skill.level}** (#${helper.formatNumber(skill.rank)})`;
            else
                field['name'] = `**${skillEmote.toString()} ${name} ${skill.level} (#${helper.formatNumber(skill.rank)})**`;

            if(skill.level == skill.maxLevel)
                field['value'] = `**${skill.xpForNext === 0 ? '–' : helper.formatNumber(skill.xpCurrent, true)}** XP`;
            else
                field['value'] = `**${skill.xpForNext === 0 ? '–' : helper.formatNumber(skill.xpCurrent, true)}** / ${skill.xpForNext === 0 ? '–' : helper.formatNumber(skill.xpForNext, false)} XP`;

            field['value'] += ` (**${helper.formatNumber(skill.xp, true)}**)`;

            if(!msg.channel.name.includes('commands'))
                field['name'] = `**${field['name']}**`;

            fields.push(field.name);

            if(msg.channel.name.includes('commands'))
                fields.push(field.value);
            else if(index > skillsSorted.length - 3)
                fields.push("⠀");

            reactions.push(skillEmote);
        }

        for(let i = 0; i < fields.length; i += 2){
            const field = {
                inline: true,
                name: fields[i],
                value: fields[i + 1]
            };

            if(embed.fields.length % 3 != 0)
                embed.fields.push({
                    inline: true,
                    name: "⠀",
                    value: "⠀"
                });

            embed.fields.push(field);
        }

        let currentSkill = null;

        if(customSkill){
            currentSkill = customSkill;

            await message.edit({ embed: skillEmbed(profile, customSkill, embed) });
        }else{
            await message.edit({ embed });
        }

        reactions.unshift('⬅️');

        reactions.map(a => message.react(a));

        const collector = message.createReactionCollector(
            (reaction, user) => user.bot === false,
            { idle: 120 * 1000 }
        );

        collector.on('collect', async (reaction, user) => {
            reaction.users.remove(user.id).catch(console.error);

            if(user.id != msg.author.id)
                return;

            if(reaction._emoji.name == '⬅️'){
                if(currentSkill === null)
                    return;

                currentSkill = null;
                message.edit({ embed });

                return;
            }

            const skillName = reaction._emoji.name.substring(2).toLowerCase();

            if(skillName == currentSkill)
                return;

            currentSkill = skillName;

            message.edit({ embed: skillEmbed(profile, skillName, embed) });
        });

        collector.on('end', () => {
            message.reactions.removeAll();
        });

        return null;
    }
};
