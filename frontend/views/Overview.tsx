import React, { useState, useEffect } from "react";
import TabPanel from "../components/TabPanel";
import {
  Alert as MuiAlert,
  AlertTitle,
  Button,
  Container,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Typography,
} from "@mui/material";
import { Queue, SqsMessage } from "../types";
import CreateQueueDialog from "../components/CreateQueueDialog";
import Alert from "../components/Alert";
import useInterval from "../hooks/useInterval";
import SendMessageDialog from "../components/SendMessageDialog";
import { callApi } from "../api/Http";
import MessageItem from "../components/MessageItem";
import QueueIcon from "@mui/icons-material/CalendarViewWeek";
import Grid from "@mui/material/Unstable_Grid2";

const a11yProps = (id: string, index: number) => {
  return {
    key: index,
    "aria-controls": `queue-${id}-${index}`,
  };
};

const Overview = () => {
  const [listItemIndex, setListItemIndex] = useState(0);
  const [queues, setQueues] = useState([] as Queue[]);
  const [messages, setMessages] = useState([] as SqsMessage[]);
  const [reload, triggerReload] = useState(true);
  const [error, setError] = useState("");
  const [disabledStatus, setDisabledStatus] = useState(true);

  useInterval(async () => {
    await receiveMessageFromCurrentQueue();
  }, 3000);

  useEffect(() => {
    receiveMessageFromCurrentQueue();
    // eslint-disable-next-line
  }, [queues, listItemIndex]);

  useEffect(() => {
    callApi({
      method: "GET",
      onSuccess: (data: Queue[]) => {
        setQueues(data);
        if (data.length > 0) {
          setListItemIndex(data.length - 1);
          setDisabledStatus(false);
        } else {
          setListItemIndex(0);
          setDisabledStatus(true);
        }
      },
      onError: setError,
    });
  }, [reload]);

  const selectQueue = (event: React.MouseEvent<HTMLLIElement, MouseEvent>) => {
    setListItemIndex(event.currentTarget.value);
  };

  const receiveMessageFromCurrentQueue = async () => {
    let queueUrl = queues[listItemIndex]?.QueueUrl || null;
    if (queueUrl != null) {
      await callApi({
        method: "POST",
        action: "GetMessages",
        queue: queues[listItemIndex],
        onSuccess: setMessages,
        onError: setError,
      });
    }
  };

  const createNewQueue = async (queue: Queue) => {
    await callApi({
      method: "POST",
      action: "CreateQueue",
      queue: queue,
      onSuccess: () => {
        setTimeout(() => {
          triggerReload(!reload);
        }, 1000);
      },
      onError: setError,
    });
  };

  const purgeCurrentQueue = async () => {
    await callApi({
      method: "POST",
      action: "PurgeQueue",
      queue: queues[listItemIndex],
      onSuccess: () => {
        setMessages([]);
      },
      onError: setError,
    });
  };

  const deleteCurrentQueue = async () => {
    await callApi({
      method: "POST",
      action: "DeleteQueue",
      queue: queues[listItemIndex],
      onSuccess: () => {
        setMessages([]);
        setTimeout(() => {
          triggerReload(!reload);
        }, 1000);
      },
      onError: setError,
    });
  };

  const sendMessageToCurrentQueue = async (message: SqsMessage) => {
    let queueUrl = queues[listItemIndex]?.QueueUrl || null;
    if (queueUrl !== null) {
      if (
        queues[listItemIndex]?.QueueName.endsWith(".fifo") &&
        !message.messageAttributes?.MessageGroupId
      ) {
        setError(
          "You need to set a MessageGroupID when sending Messages to a FIFO queue"
        );
        return;
      }
      await callApi({
        method: "POST",
        action: "SendMessage",
        queue: queues[listItemIndex],
        message: message,
        onSuccess: () => {},
        onError: setError,
      });
    } else {
      setError("Could not send message to non-existent queue");
    }
  };

  return (
    <Grid container spacing={0}>
      <Grid xs={3}>
        <Drawer
          sx={{
            flexShrink: 0,
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
            },
          }}
          variant="permanent"
          anchor="left"
        >
          <List>
            <ListItem>
              <Typography variant="h6" margin={"auto"}>
                SQS Admin UI
              </Typography>
            </ListItem>
            <ListItem>
              <Toolbar
                sx={{
                  gap: 1,
                  display: "grid",
                  gridTemplateColumns: "repeat(2, 1fr)",
                }}
              >
                <CreateQueueDialog onSubmit={createNewQueue} />
                <Button
                  variant="contained"
                  disabled={disabledStatus}
                  onClick={deleteCurrentQueue}
                >
                  Delete Queue
                </Button>
                <SendMessageDialog
                  disabled={disabledStatus}
                  onSubmit={sendMessageToCurrentQueue}
                  queue={queues[listItemIndex]}
                />
                <Button
                  variant="contained"
                  disabled={disabledStatus}
                  onClick={purgeCurrentQueue}
                >
                  Purge Queue
                </Button>
              </Toolbar>
            </ListItem>
          </List>
          <Divider />
          <Divider />
          <List>
            {queues?.map((queue, index) => (
              <ListItem
                {...a11yProps("item", index)}
                onClick={selectQueue}
                value={index}
                disablePadding
              >
                <ListItemButton selected={index === listItemIndex}>
                  <ListItemIcon>
                    <QueueIcon />
                  </ListItemIcon>
                  <ListItemText primary={queue.QueueName} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Drawer>
      </Grid>
      <Grid xs={9}>
        <Grid container spacing={0}>
          <Grid xs={9}>
            <Toolbar>
              <Typography variant="h6" margin={"auto"}>
                Messages
              </Typography>
            </Toolbar>
          </Grid>
          <Grid xs={9}>
            {error !== "" ? (
              <Container maxWidth="md">
                <Alert
                  message={error}
                  severity={"error"}
                  onClose={() => setError("")}
                />
              </Container>
            ) : null}
            {queues?.length === 0 ? (
              <Container maxWidth="md">
                <MuiAlert severity="info">
                  <AlertTitle>No Queue</AlertTitle>
                  No Queues exist in region (default was "eu-central-1")
                </MuiAlert>
              </Container>
            ) : null}
          </Grid>
          <Grid xs={9}>
            {queues?.map((queue, index) => (
              <TabPanel
                value={listItemIndex}
                index={index}
                {...a11yProps("tabpanel", index)}
              >
                <Grid container spacing={2}>
                  {messages?.map((message, index) => (
                    <Grid xs={12} {...a11yProps("gridItem", index)}>
                      <Paper>
                        <MessageItem
                          data={message}
                          {...a11yProps("messageItem", index)}
                        />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </TabPanel>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Grid>
  );
};

export default Overview;
